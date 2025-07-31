// server.js

// 1. Import Dependencies
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const mammoth = require('mammoth');
require('dotenv').config();
const fetch = require('./utils/fetcher');
const PS_API_KEY = process.env.PS_API_KEY;
const PS_BASE_URL = 'https://public-api.process.st/api/v1.1';
if (!PS_API_KEY) {
  console.error('PS_API_KEY is not set in .env');
  process.exit(1);
}
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const pdf = require('pdf-parse');
const { mdToPdf } = require('md-to-pdf');
const PPTX = require('pptxgenjs');
const { brandContext } = require('./config/brandContext');
const { generateWithFallback } = require('./services/aiProvider');
const { logAiUsage } = require('./utils/logging');

// 2. Initialize Express App & Gemini AI
const app = express();
const PORT = process.env.PORT || 8000;

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not set. Please create a .env file and add it.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- Google Sheets Integration ---
async function getPricingSheetData(retries = 3) {
    console.log('[Data Ingestion] Authenticating with Google Sheets...');
    const auth = new GoogleAuth({
        keyFile: 'credentials.json',
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME; // Re-introduce the specific sheet name

    if (!spreadsheetId || !sheetName) {
        throw new Error("Both GOOGLE_SHEET_ID and GOOGLE_SHEET_NAME must be set in the .env file.");
    }

    console.log(`[Data Ingestion] Fetching data from specific sheet: "${sheetName}"...`);

    for (let i = 0; i < retries; i++) {
        try {
            const rows = await googleSheets.spreadsheets.values.get({
                auth,
                spreadsheetId,
                range: sheetName, // Target the specific sheet name directly
            });

            const pricingData = rows.data.values;
            if (!pricingData || pricingData.length === 0) {
                console.warn(`[Data Ingestion] No data found in sheet: "${sheetName}".`);
                return [];
            }

            console.log(`[Data Ingestion] Successfully fetched ${pricingData.length} rows from "${sheetName}".`);
            return pricingData;
        } catch (error) {
            console.warn(`Sheets API attempt ${i + 1} failed.`, error.message);
            if (i === retries - 1) {
                console.error("Error fetching Google Sheet data:", error.message);
                if (error.code === 400) {
                    console.error(`This might mean the sheet name "${process.env.GOOGLE_SHEET_NAME}" is incorrect or does not exist in the spreadsheet.`);
                } else if (error.code === 404) {
                    console.error(`This might mean the spreadsheet ID "${process.env.GOOGLE_SHEET_ID}" is incorrect.`);
                }
                console.error("Please ensure 'credentials.json' exists and the GOOGLE_SHEET_ID/GOOGLE_SHEET_NAME are correct in .env.");
                throw new Error("Could not fetch pricing data from Google Sheets.");
            }
            await new Promise(res => setTimeout(res, 1500));
        }
    }
}

// --- Resilient API Caller with Retry Logic ---
async function generateContentWithRetry(prompt, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.warn(`API call attempt ${i + 1} failed. Retrying...`, error.message);
            if (i === retries - 1) {
                console.error("All API retry attempts failed.");
                throw error;
            }
            await new Promise(res => setTimeout(res, 1500));
        }
    }
}


// --- SPECIALIST AGENT FUNCTIONS ---

/**
 * Agent 0: Data Ingestion
 */
async function dataIngestionAgent(text) { // The variable is named 'text'
    console.log('[Agent 0: Data Ingestion] Structuring raw text into JSON...');
    const prompt = `
        You are an expert business analyst. Analyze the entire Business Requirements Document (BRD) provided. Your task is to extract and synthesize all key information into a single, comprehensive JSON object.

        Go beyond simple keyword extraction. Infer and structure the following:
        1.  **ClientProfile:** Company name, contact details, website, industry/vertical, and a brief summary of their business model.
        2.  **ProjectSummary:** The core project objective (e.g., "WordPress to Shopify Migration").
        3.  **CurrentStateAnalysis:** Details about their current platform (e.g., WordPress + WooCommerce), known pain points or limitations (e.g., "limited scalability," "performance bottlenecks"), and key stats (e.g., product count, monthly traffic).
        4.  **StrategicGoals:** The high-level business goals driving this project. Synthesize these from the text into clear objectives like "Increase Revenue Growth," "Enhance Customer Retention," or "Strengthen Market Position."
        5.  **KeyFeaturesAndScope:** A list of all required features, functionalities, required apps, and deliverables (e.g., "B2B/Wholesale Portal," "Loyalty Program," "Custom 'Brew Guide' Quiz").
        6.  **Stakeholders:** Lists of client, internal, and third-party stakeholders.

        If a specific value isn't found, use "N/A" or an empty array. This JSON will be the single source of truth for all subsequent generation tasks.

        BRD Text: """${text}"""
    `;
    const rawResponse = await generateContentWithRetry(prompt);

    try {
        // Log the type and raw response for debugging
        // console.log('[Agent 0: Data Ingestion] Raw response type:', typeof rawResponse);
        // console.log('[Agent 0: Data Ingestion] Raw response content:', rawResponse);

        if (typeof rawResponse === 'string') {
            // Attempt to remove markdown fences and trim whitespace
            const cleanedString = rawResponse.replace(/^```json\s*|```\s*$/g, '').trim();

            // Log cleaned string before parsing for debugging
            // console.log('[Agent 0: Data Ingestion] Cleaned string for parsing:', cleanedString);

            if (cleanedString === "") {
                console.error("[Agent 0: Data Ingestion] Cleaned string is empty after removing fences.");
                throw new Error("Cleaned string is empty, cannot parse JSON.");
            }
            try {
                return JSON.parse(cleanedString);
            } catch (parseError) {
                console.error("[Agent 0: Data Ingestion] Failed to parse cleaned string:", cleanedString);
                console.error("[Agent 0: Data Ingestion] JSON.parse error:", parseError.message);
                // Attempt to find JSON within a larger string if simple parsing fails
                // This is a common case if the model adds explanations around the JSON block
                const jsonMatch = cleanedString.match(/\{[\s\S]*\}/);
                if (jsonMatch && jsonMatch[0]) {
                    console.log("[Agent 0: Data Ingestion] Attempting to parse extracted JSON block from string...");
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (nestedParseError) {
                         console.error("[Agent 0: Data Ingestion] Failed to parse extracted JSON block:", jsonMatch[0]);
                         console.error("[Agent 0: Data Ingestion] Nested JSON.parse error:", nestedParseError.message);
                         throw new Error("Data Ingestion Agent failed to parse JSON even after extraction.");
                    }
                }
                throw new Error("Data Ingestion Agent failed to parse JSON from string response.");
            }
        } else if (typeof rawResponse === 'object' && rawResponse !== null) {
            // If it's already an object, assume it's the correct JSON and return it
            console.log('[Agent 0: Data Ingestion] Response is already an object. Returning directly.');
            return rawResponse;
        } else {
            // Handle cases where the response is neither a string nor a valid object
            console.error('[Agent 0: Data Ingestion] Unexpected response type:', typeof rawResponse, rawResponse);
            throw new Error(`Data Ingestion Agent received an unexpected response type: ${typeof rawResponse}`);
        }
    } catch (e) {
        // Log the error and the problematic response text before re-throwing
        console.error("[Agent 0: Data Ingestion] Error during JSON processing:", e.message);
        // console.error("[Agent 0: Data Ingestion] Original problematic rawResponse for context:", rawResponse); // Be cautious logging potentially large/sensitive data
        // Ensure a consistent error message for upstream consumers
        throw new Error("Data Ingestion Agent failed to return valid JSON.");
    }
}

/**
 * Agent 2: Contextual Overview
 * Generates the high-level project overview, current state analysis,
 * and strategic objectives sections, mirroring a high-quality SOW.
 * @param {object} data The comprehensive JSON object from Agent 0.
 * @returns {Promise<string>} A promise that resolves to the formatted markdown string.
 */
async function contextualOverviewAgent(data) {
    console.log('[Agent 2: Contextual Overview] Generating high-level project summary...');
    const prompt = `
    You are a Senior Project Director. Using the provided JSON data, generate three distinct sections for a Scope of Work presentation. The tone must be professional and authoritative.

    ---
    ### PART 1: PROJECT OVERVIEW

    Create a concise, high-impact project overview slide.
    - **Project Title:** Use the project's main objective from the JSON.
    - **Project Details Table:** Create a key-value list (using bold for keys) summarizing these details:
        - Client: (from data.ClientProfile.brandName)
        - Target Platform: (from data.ProjectSummary.platform)
        - Current Platform: (from data.CurrentStateAnalysis.platform)
        - Key Deliverables: (Summarize the top 3-4 features from data.KeyFeaturesAndScope)
    - **Project Timeline Overview:** Write a brief paragraph describing the major project phases (e.g., Discovery, Architecture, Migration, Integration, Launch) and include the estimated duration if available in the JSON.

    ---
    ### PART 2: CURRENT STATE ANALYSIS & BUSINESS DETAILS

    Create a narrative slide about the client's current situation.
    - **Company Overview:** Write a paragraph summarizing the client's business, brand, and market position based on the ClientProfile section of the JSON.
    - **Current Platform Limitations:** Create a bulleted list of the pain points and limitations of their current system as detailed in the JSON (e.g., "Limited scalability," "Performance bottlenecks").
    - **Business Details Table:** Create a key-value list for details like Brand Status, Location, and Customer Base.

    ---
    ### PART 3: STRATEGIC BUSINESS OBJECTIVES

    Create a compelling narrative about the project's strategic goals.
    - **Client's Vision:** Start with a powerful sentence that summarizes the client's overall vision for their digital future, based on the provided strategic goals.
    - **Strategic Imperatives:** Create a bulleted list of the high-level business goals identified in the JSON (e.g., "Revenue Growth," "Enhance Customer Retention"). For each goal, add a one-sentence description of how this project achieves it.
    - **Key Migration Objectives:** Create another bulleted list detailing the specific, tangible project outcomes (e.g., "Enterprise Platform Upgrade," "SEO Preservation & Enhancement," "Integration Ecosystem").

    ---
    **JSON Data for context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
    `;
    const raw = await generateContentWithRetry(prompt);
    return raw;
}

/**
 * Agent 1: Project Details Summary
 */
async function headerAndIntroductionAgent(data, brandContext) {
    const prompt = ` You are a project manager preparing a Scope of Work document. Based on the structured JSON data provided, generate the introductory sections of the SOW. The output must be a single Markdown document that strictly follows this three-part structure, with no extra commentary or headings.

PART 1: DOCUMENT HEADER & TITLE
Generate the document's main title and header information. The structure must be exactly:

Line 1: Scope Of Work
Line 2: ${data.clientEmail || 'client.email@example.com'}
Line 3: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Line 4: (empty line)
Line 5: Prepared by: Bradley Bryant
PART 2: PROJECT DETAILS
Render this section under the bolded heading PROJECT DETAILS. The format must be a two-column, key-value layout. Do not use pipe delimiters or markdown table syntax.

The list must include the following keys, populated from the JSON data:

Project Leads: This must be a multi-line entry including our static leads and the dynamic client lead from the BRD. Format it as:
Bradley (Chief Operations Officer) | SOW - bradley@ecomplete.co.za
Cara (Head of operations - Client success) - cara@ecomplete.co.za
${data.clientLeadName || 'Client Lead Name'} (Project lead) - ${data.clientLeadEmail || 'client.lead@example.com'}
Objective: ${data.objective || 'New eCommerce Website, migrations, design & functionality as per client requirements.'}
Website: ${data.brandName || 'Client Brand Name'}
Build: ${data.buildPlatform || 'Shopify PLUS'}
Estimated Launch: ${data.estimatedLaunch || 'TBD'}
Key Features: This is a special, multi-part entry. The first line has the label, and subsequent lines are indented by leaving the label column blank. Pull the solution description for each from the BRD.
Key Features:
Web, Hosting & Security: [Describe solution from BRD]
Customer service: [Describe solution from BRD]
SEO: [Describe solution from BRD]
Design: [Describe solution from BRD]
CRM: [Describe solution from BRD]
Digital Marketing: [Describe solution from BRD]
Custom: [Describe solution from BRD]
PART 3: A PERSONAL INTRODUCTION
Compose a letter-style introduction with the following precise structure.

Greeting & Tagline:

Start with the headline: Hello, ${data.clientEmail || 'client.email@example.com'}
On the next line, add the italicized tagline: ${brandContext.tagline}
Opening Paragraph:

Begin with a personal salutation: Hi ${data.clientFirstName || 'there'},
Write a paragraph expressing excitement. It must incorporate the client's key drivers from the BRD, like "bolstering your eCommerce experience", "additional functionality", and "custom requirements". State our commitment to making the project "as smooth and efficient as possible".
SOW Definition Paragraph:

Write a paragraph that defines this document. Explain that the Scope of Work (SOW) details the "full scope and range of the services and features" and will serve as the "go-to doc" for "clarity and agreement".
Disclaimer & Call-to-Action Paragraph:

Write a paragraph stating the client should "ensure that all the details in this document are correct before you sign off". Emphasize that the SOW serves as the "final say on what your eCommerce environment has and what it does not."
Contact Information:

Conclude with the phrase: You can reach me on the following details:
List the contact details for the eComplete Project Lead. Format as:
Name: Bradley Bryant
Mobile: [Project Lead Mobile Number]
Email: bradley@ecomplete.co.za
JSON Data for context: """ ${JSON.stringify(data, null, 2)} """ `;
    return await generateContentWithRetry(prompt);
}

/**
 * Agent 3: Essential Info & Data
 */
async function essentialInfoAgent(data) {
    console.log('[Agent 3: Essential Info] Generating essential info section...');
    const prompt = `
    You are a technical writer tasked with documenting project specifications for a Scope of Work.
    Using the structured JSON data, generate three distinct sections: "Essential Info", "Data", and "Store Functionality".
    The output must be a single Markdown document. **For all key-value lists in this task, do not use pipe delimiters or markdown table syntax.** Format them as a bolded label followed by the value.

    ---

    ### PART 1: ESSENTIAL INFO

    Generate this section under the main heading \`## Essential Info\`. It must contain two sub-sections.

    #### 1.1. Customer Information
    - Under the sub-heading \`### Customer Information\`, create a key-value list for the following client details from the BRD:
        - **Brand Name:**
        - **Registered Company Name:**
        - **Client Name & Surname:**
        - **Title:**
        - **Client Phone Number:**
        - **Client Email:**
        - **Website:**
        - **Web Email Address:**
        - **Facebook:**
        - **Instagram:**
        - **TikTok:**
        - **YouTube:**

    #### 1.2. Additional Information
    - Under the sub-heading \`### Additional Information\`, create a key-value list for the following project details from the BRD:
        - **Vertical:**
        - **Description:**
        - **Trading in:**
        - **Physical Retail stores?:**
        - **Takealot Marketplace?:**
        - **Google Analytics Shared:**
        - **Brand CI:**

    ---

    ### PART 2: DATA SPECIFICATIONS

    Generate this section under the main heading \`## Data\`.
    - Create a key-value list for the following fields based on the BRD. Include any specific notes or details provided for each.
        - **SKU count:**
        - **Stock2Shop:**
        - **Product Images:**
        - **Configurable Products:**
        - **PIM:**
        - **Loyalty programs:**
        - **(TAX) we receive prices:**

    ---

    ### PART 3: STORE FUNCTIONALITY

    Generate this section under the main heading \`## Store Functionality\`. It must contain two sub-sections.

    #### 3.1. Platform Details
    - Create this sub-section with the dynamic heading \`### ${data.buildPlatform || 'Platform'} Details\`.
    - Populate the following fields in a key-value list:
        - **Staging Domains:**
        - **Go Live Domain:**
        - **Do you have access to your domain?:**
        - **Cloudways Hosting:**
        - **Cloudflare / CDN:**
        - **Platform:**
        - **Version:**
        - **SMTP:**
        - **Chat Bot:**

    #### 3.2. Payments
    - Create this sub-section with the heading \`### Payments\`.
    - Populate the following payment configuration details in a key-value list. For BNPL, list each provider on a new line.
        - **Merchant ID:**
        - **Payment Gateway:**
        - **Mastercard & VISA:**
        - **Instant EFT:**
        - **BNPL:**

    ---

    **JSON Data for context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;
    const start = Date.now();
    const { text, source } = await generateWithFallback(prompt);
    logAiUsage({ prompt, source, duration: Date.now() - start, outputLength: text.length });
    return text;
}

/**
 * Agent 4: Pages & Tech
 */
async function pagesAndTechAgent(data) {
    console.log('[Agent 4: Pages & Tech] Generating pages and tech stack sections...');
    const prompt = `
    You are a solutions architect documenting the project's page and technology specifications for a Scope of Work.
    Generate two distinct sections: "Pages" and "Technology Stack".

    ---

    ### PART 1: PAGES (Section 7)

    Generate this section under the main heading \`## 7. Pages\`. It must contain two sub-sections.
    **For all key-value lists in this "Pages" section, do not use pipe delimiters.** Format them as a bolded label followed by the value.

    #### 7.1. Standard Pages (Per Brand)
    - Under the sub-heading \`### Standard Pages (Per Brand)\`, create a key-value list.
    - The first item, **Standard Pages**, must have a multi-line value including: Customer Login Portal, Homepage, Category pages, Product full details page, Shopping Cart, Checkout, My Accounts, Outlet, Blog, Other CMS pages, and TBC post Information Architecture.
    - Then, add the following items: **Contact us**, **Privacy**, **Returns & Exchanges / Refunds policy**, **Newsletter - Lets Collaborate**, **About us**, **Terms & Conditions**, **FAQs**, **Cookie Policy**, and **Shipping Policy**. Populate their descriptions from the BRD.

    #### 7.2. Additional Pages
    - Under the sub-heading \`### Additional Pages\`, create a key-value list for **Landing Pages**, describing the scope for migrating existing content as detailed in the BRD.

    ---

    ### PART 2: TECHNOLOGY STACK (Section 16)

    Generate this section under the main heading \`## 16. Technology Stack\`. It must have three parts.

    #### 16.1. Core Technology Table
    - Create a key-value list (no pipes) with two rows:
        - **Development Environment**: Populate this from the BRD (e.g., 'Shopify PLUS').
        - **Technologies Stack**: Use the static text: 'Shopify liquid code for theme development, jQuery, JavaScript, HTML, CSS, PHP & MySQL'.

    #### 16.2. Supported Browsers
    - Add the sub-heading: \`### The supported standard browsers are:\`
    - Below it, list the standard browsers: Google Chrome, Firefox, Safari, and Microsoft Edge, including platform details (Windows, MAC, Mobile, etc.).

    #### 16.3. Supported Screen Sizes
    - Add the sub-heading: \`### The supported standard screen sizes for this website are:\`
    - Below it, create a **pipe-delimited table** with the standard resolutions:
    \`\`\`
    1900 X 1200 | 1366 X 768
    1024 X 768 | 1024 X 1366
    1280 X 800 | 414 X 736
    \`\`\`

    ---

    **JSON Data for context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;
    return await generateContentWithRetry(prompt);
}

/**
 * Agent 5: Stakeholders & Purpose
 */
async function stakeholdersAndPurposeAgent(data, brandContext) {
    console.log('[Agent 5: Stakeholders & Purpose] Generating stakeholders and project purpose sections...');
    const prompt = `
    You are a senior project manager writing the strategic overview for a Scope of Work.
    Generate two distinct sections: "Stakeholders" and "Project Purpose".

    ---

    ### PART 1: STAKEHOLDERS (Section 8)

    Generate this section under the main heading \`## 8. Stakeholders\`.
    - The output **must be a clean, pipe-delimited Markdown table** with the exact columns: \`Name | Email | Title | Company\`.
    - The table should include only client and third-party stakeholders from the BRD.
    - eComplete stakeholder rows will be injected separately.

    ---

    ### PART 2: PROJECT PURPOSE (Section 9)

    Generate this section under the main heading \`## 9. Project Purpose\`.
    - Do NOT include any information about "Architecture" or diagrams.
    - Compose a formal, multi-paragraph description of the project's core objectives, synthesized from the BRD.
    - This description **must include**:
        - The primary goal, platform, and client name (e.g., "Rebuild [Client Name].co.za on Shopify PLUS...").
        - The specific theme or design framework to be used (e.g., "...following the [Name of Theme] guidelines.").
        - A statement clarifying design collaboration between the client's UI/UX team and eComplete.
        - The standard concluding sentence: "Site will be responsive and accessible across various standard mobile, tablet, and desktop browsers."

    ---

    **JSON Data for context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;
    return await generateContentWithRetry(prompt);
}

/**
 * Agent 6: Project & Feature Scope
 */
async function projectScopeAgent(data) {
    console.log('[Agent 6: Project Scope] Generating project objectives and feature scope sections...');
    const prompt = `
    You are a technical business analyst creating the detailed scope sections for a Scope of Work document.
    Generate two distinct, comprehensive sections: "Project Objectives and Overall Services" and "Scope of Work: Website Features".
    The output must be a single Markdown document.

    ---

    ### PART 1: PROJECT OBJECTIVES AND OVERALL SERVICES (Section 10)

    This is a descriptive, prose-based section. **Do not use a table format here.**

    1.  Start with this exact sentence about SEO: \`The site is to be SEO optimised and use Schema.org property definitions and tags where necessary.\`

    2.  **10.1 Project Objectives**
        - Under the heading \`### 10.1 Project Objectives\`, write an introductory paragraph specifying the core technical approach synthesized from the BRD. This must include the theme to be used (e.g., "Mini Mog"), the tech stack ("Liquid code, JavaScript, jQuery, HTML, and CSS"), and a statement on adhering to "best practices outlined in the Shopify Plus development guidelines."

    3.  **10.2 Overall Services**
        - Under the heading \`### 10.2 Overall services which included in this project to completed\`, generate a numbered list.
        - Each item must have a **bolded title** followed by a descriptive paragraph. The list must cover: **Business Analysis and Consultation**, **UI/UX Design**, **Database Architecture**, **Development**, **Quality Assurance and Security Implementation**, **Admin Panel**, **Setting Up Standard Git Version Control**, and **Post Launch Support**.

    ---

    ### PART 2: SCOPE OF WORK: WEBSITE FEATURES (Section 11)

    This is a highly detailed section. It must be generated in two parts: a summary table, then an exhaustive breakdown.

    #### 11.1 Introduction and Feature Summary Table
    - **Introduction:** Write a 2-3 paragraph intro summarizing the front-end objective from the BRD. Mention the base theme and the importance of the client's design input (e.g., "with Ackermans figma design input").
    - **Summary Table:** Generate a **pipe-delimited table** with the columns: \`No. | Section | Type | Note\`.
    - The rows must be a high-level summary of the site's functional areas: Header Section, Footer Section, Home Page, Category / Collection Pages (PLP), Product Detail Page (PDP), eCommerce features/Pages, and CMS Pages.

    #### 11.2 Detailed Component Breakdown
    - For each 'Section' listed in the summary table, generate a corresponding detailed breakdown with a numbered sub-heading (e.g., \`#### 11.2.1 Header Section\`).

    - **Header Section:** Detail the components of the Top Header and Main Header.
    - **Footer Section:** Describe the theme-based footer, including Top and Main footer components.
    - **Home Page:** Provide a section-by-section breakdown of all homepage content blocks from the BRD.
    - **Category / Collection Pages (PLP):** Describe the layout, including left-side filters, product grid structure, 'Quick add to cart' feature, and pagination.
    - **Product Detail Page (PDP):** Provide a comprehensive **bulleted list** of all PDP elements based on the BRD. **CRITICAL: You must OMIT any mention of "Check In store Stock".** Include elements like product image carousel, title/price, BNPL calculator, promotions block, size/color selectors, 'Add to cart', Wash Care & Size Guide popups, and product recommendations.
    - **eCommerce Features (Theme and Shopify based):** Create a descriptive section with **bolded sub-headings**. **CRITICAL: You must EXCLUDE "Shipping" and "Store Locator" from this list.** The list must cover: \`Cart Page\`, \`One Step Checkout Page\`, \`Wishlist\`, \`Mini Cart\`, \`Promotion Coupon\`, \`Payment\`, and the \`Customer Section\` (Login, My Account, etc.).
    - **CMS Pages:** Generate a comprehensive, multi-level numbered list of all required static content pages from the BRD.

    ---

    **JSON Data for context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;
    return await generateContentWithRetry(prompt);
}


/**
 * Agent 8: 3rd Party Apps
 */
async function thirdPartyAppsAgent(data, pricingData) {
    console.log('[Agent 8: 3rd Party Apps] Generating app list with pricing...');
    const prompt = `
    You are a technical consultant responsible for specifying third-party application requirements for a Scope of Work.
    Your task is to generate the "3rd Party App Considerations" section (Section 13).
    You must analyze the "Required Apps from BRD" and cross-reference them with the "Pricing Sheet Data" to create a series of detailed tables.

    The final output must be a single Markdown document with an introduction and multiple, functionally-grouped tables.

    ---

    ### PART 1: INTRODUCTION

    Begin with a standard introductory paragraph: "The following is a list of third-party apps that will be installed and configured by eComplete as per Shopify's policies. We will require all credentials and access to install and configure the necessary apps, and our team will be in touch to get the required access."

    ---

    ### PART 2: FUNCTIONAL APP TABLES

    Generate a series of individual, pipe-delimited tables, each under its own functional sub-heading.
    - Each table must have these exact five columns: \`No. | Features | Details | APP | APP Cost /month\`
    - For each app mentioned in the "Required Apps from BRD", find its details and monthly cost in the "Pricing Sheet Data" and place it in the correct table below.
    - If a price is not available, use "TBD".

    **CRITICAL EXCLUSION:** You must **OMIT** any tables or apps related to **"Shipping"** or **"Return"** functionality.

    Generate tables ONLY for the following required functional headings:
    - \`### Products\`
    - \`### Product Comparison\`
    - \`### Deal\`
    - \`### Coupons\`
    - \`### Merchandising\`
    - \`### CMS\`
    - \`### SEO\`
    - \`### Wish List\`
    - \`### Advanced Search\`
    - \`### Payment\`
    - \`### Wallet/Credit\`
    - \`### Customer Account / Profile\`
    - \`### Miscellaneous\`

    ---

    **Source 1: Required Apps from BRD:**
    """
    ${JSON.stringify(data.requiredApps, null, 2)}
    """

    **Source 2: Pricing Sheet Data (Array of Arrays format):**
    """
    ${JSON.stringify(pricingData, null, 2)}
    """
`;
    return await generateContentWithRetry(prompt);
}

/**
 * Agent 9: App Cost Summary
 */
async function appCostSummaryAgent(appsMarkdown) {
    console.log('[Agent 9: App Cost Summary] Generating app cost summary section...');
    const prompt = `
    You are a project manager responsible for creating a clear cost summary for a Scope of Work.
    Your task is to parse the provided "3rd Party App Considerations Markdown" and generate the "3rd Party Shopify APP Costs" section (Section 14).

    The output must be a single Markdown document containing one or more cost tables followed by standard boilerplate notes.

    ---

    ### PART 1: APP COST TABLES

    1.  Read the input markdown, which contains detailed tables of apps.
    2.  Create a new, two-column summary table that lists every unique third-party app and its monthly cost. The columns must be: \`[App Name] | $ APP Cost /month\`.
    3.  If the input markdown contains phases (e.g., "Phase 1"), create a separate summary table for each phase.
    4.  At the bottom of each summary table, you MUST add two calculated rows:
        - **Total:** The sum of all values in the \`$ APP Cost /month\` column for that table.
        - **ZAR:** The South African Rand equivalent of the Total. Use a current, realistic exchange rate for the calculation (e.g., 1 USD = 19 ZAR) and show the calculation. Example: \`RXXX.xx (USD XX * 19.0)\`

    ---

    ### PART 2: IMPORTANT NOTES

    - Following the final cost table, add the bolded heading \`Note:\`.
    - Under this heading, insert the standard, multi-paragraph boilerplate text covering these points:
        - **App Support:** Our process for handling third-party app issues and how time spent on them is billed.
        - **Custom/Non-Store Apps:** The policy that apps not on the Shopify store are considered custom and out of scope unless specified.
        - **Additional App Requests:** The policy that any new app requests will be treated as add-ons with additional costs.

    ---

    **Source Markdown (from the previous agent):**
    """
    ${appsMarkdown}
    """
`;
    return await generateContentWithRetry(prompt);
}

/**
 * Agent 10: Governance Agent
 */
async function governanceAgent(data) {
    console.log('[Agent 10: Governance] Generating governance sections...');
    const prompt = `
    You are a senior project manager writing the governance and boundary-setting sections for a formal Scope of Work.
    Your task is to generate three sections: "Assumptions," "Change Request Management," and "Exclusions."
    The output must be clean, professional, and follow the specified format precisely.

    ---

    ### PART 1: ASSUMPTIONS (Section 17)

    - Under the heading \`## 17. Assumptions\`, generate a numbered list where each item begins with a **bolded title**.
    - The list must include standard project assumptions for: **Content Submission**, **Infrastructure**, **Design Integration**, **Development**, and **3rd Party Choices**.
    - You must also analyze the BRD context provided in the JSON and add a contextual assumption for **API Availability**, mentioning any key third-party systems by name.

    ---

    ### PART 2: CHANGE REQUEST MANAGEMENT (Section 18)

    - Under the heading \`## 18. Change Request Management\`, generate standard boilerplate text.
    - Include a paragraph for the **Process Overview**.
    - Include a numbered list with bolded titles for the precise **Definition of Change Request** and **Definition of Add-ons**.

    ---

    ### PART 3: EXCLUSIONS (Section 19)

    - Under the heading \`## 19. Exclusion\`, generate a comprehensive numbered list of items that are out of scope. Each item must have a **bolded title**.
    - Begin with the standard boilerplate clauses for **Development of Detailed Technical Functional Specification** and **Out of Scope**.
    - Append a list of specific, common exclusions, ensuring these are mentioned: **Third-Party Fees**, **Content Creation & Data Entry**, **Digital Marketing Ad Spend**, and **Domain Name Registration**.

    ---

    **JSON Data for high-level context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;
    return await generateContentWithRetry(prompt);
}
/**
 * Agent 10: Project Management & Deliverables
 * Generates the final SOW sections covering the project management approach,
 * monitoring and tracking plans, and final deliverables.
 *
 * @param {object} data The comprehensive JSON object from Agent 1 (for context).
 * @returns {Promise<string>} A promise that resolves to the combined Markdown string.
 */
async function projectManagementAndDeliverablesAgent(data) {
    console.log('[Agent 10: PM] Generating project management and deliverables sections...');

    // This prompt instructs the AI to generate standard project management text and tables.
    const prompt = `
    You are a PMP-certified senior project manager creating the final project process sections of a Scope of Work document.
    Your task is to generate the sections covering project management, monitoring, and deliverables using standard, professional boilerplate text.
    The output must be a single Markdown document structured precisely as follows.

    ---

    ### PART 1: PROJECT MANAGEMENT APPROACH (Section 20)

    - Under the heading \`## 20. Project Management Approach\`, generate prose sections with the exact bolded sub-headings below.
    - **Methodology Overview**: State that our processes are based on **PMBOK® knowledge areas & SCRUM based Agile Execution.**
    - **Key Process Stages**: Include sub-sections for **Project kick-off**, **Initial Kick-off Meeting**, and **Project Planning and Work Allocations**, describing our standard process and mentioning the use of tools like **Click-Up**.
    - **Project Plan Components**: Add the lead-in sentence "A comprehensive Project plan is prepared..." and then create a bulleted list starting with a checkmark ✔ for the 11 key components (General Planning, 3rd party milestones, Client milestones, etc.).

    ---

    ### PART 2: PROJECT MONITORING AND TRACKING (Section 21)

    - Under the heading \`## 21. Project Monitoring and Tracking\`, first generate the standard overview paragraphs describing our monitoring process, the Quality Plan, and status reviews.
    - **Communication Plan Table**: Create a **pipe-delimited table** with the columns \`ACTIVITY | PROCEDURE | TOOL USED (IF ANY)\`. Populate it with the standard rows for Scheduling, Project Meeting (Internal), and Status Review Meetings.
    - **Issue Escalation Matrix**: Add the sub-heading \`### Tracking of Issues\` and then create a **pipe-delimited table** with the columns \`ISSUE TYPE | PROCEDURE | LEVELS | ESCALATION PROCEDURE\`. Populate it with the standard rows for Project Internal issues & Support Issues and Customer Issues.

    ---

    ### PART 3: PROJECT DELIVERABLES & SUPPORT (Section 22)

    - Under the heading \`## 22. Project Deliverables & Support\`, generate a numbered list where each item begins with a **bolded title**.
    - Include the standard deliverables: **Code Delivery**, **Guide**, **Support**, and **Training**.
    - **Crucially**, you must also scan the provided JSON data for any other unique project deliverables and add them to this numbered list with their own bolded titles (e.g., "**Sales Layer Setup**", "**Data Export to PowerBI**").

    ---

    **JSON Data for high-level context:**
    """
    ${JSON.stringify(data, null, 2)}
    """
`;

    return await generateContentWithRetry(prompt);
}

/**
Agent 11: Branding & Genspark Instructions
Generates the branding guidelines and the final prompt for Genspark.ai.
This agent does not call the API; it constructs a static markdown block.
@param {string} clientName The name of the client for personalizing the prompt.
@returns {Promise<string>} A promise that resolves to the markdown string.
*/
async function brandingAndGensparkInstructionsAgent(clientName, brandContext) {
    console.log('[Agent 11: Branding & Genspark Instructions] Generating branding guidelines and prompt...');
    const prompt = `
Genspark.ai Presentation Generation Instructions Objective: To create a modern, professional, and client-facing SOW presentation that is fully aligned with the ${brandContext.brandName} brand identity.
Prompt for Genspark.ai: "Generate a slide deck presentation based on the provided Statement of Work markdown for our client, ${clientName}. The presentation must strictly adhere to the following branding and style guidelines.

[cite_start]Overall Tone: The tone should be professional, confident, and clear[cite: 703, 706, 711]. It needs to reflect our position as industry leaders.

Branding Guidelines:

Primary Colors:

[cite_start]Use ${brandContext.palette.midnightTrade} (Midnight Trade) for slide backgrounds[cite: 974, 975]. [cite_start]Use ${brandContext.palette.checkoutGold} (Checkout Gold) for all major headings, key icons, and data visualization accents (like progress bars or chart elements)[cite: 978, 979]. Use #FFFFFF (White) for all body text and subheadings to ensure readability against the dark background. [cite_start]Use ${brandContext.palette.retailStone} (Retail Stone) for footer text or less important details[cite: 574, 959, 960]. Typography:

[cite_start]Font: Use '${brandContext.fonts.websafe}' as the websafe font for all text[cite: 1078, 1083]. [cite_start]Headlines: Must be Bold and in Title Case[cite: 1093]. Use a large font size for impact. [cite_start]Body Text: Must be Regular weight[cite: 1099]. Use a clean, readable font size (e.g., 16-18pt). [cite_start]Alignment: All text must be ${brandContext.defaultTextAlign || 'left'}-aligned[cite: 1181]. Logo and Tagline:

[cite_start]The ${brandContext.brandName} logo (found at ${brandContext.logoPaths.singleLogo}) must be placed in the bottom-left corner of every slide[cite: 1495, 1366]. [cite_start]Our tagline, "${brandContext.tagline}", must be placed in the bottom-right corner of every slide, in 'Retail Stone' (${brandContext.palette.retailStone}) color[cite: 629]. Slide Structure and Content:

[cite_start]Title Slide: Must include the client's name ('${clientName}'), the title 'Scope of Work Proposal', the date, and the ${brandContext.brandName} logo[cite: 4, 5, 8]. Content Slides: Break down the markdown sections into individual slides. Use icons, bullet points, and short sentences. Do not use dense paragraphs. [cite_start]Visuals: Use icons to represent services and features[cite: 1200, 1202, 1207, 1208, 1209, 1210, 1211]. [cite_start]Create timelines for project plans [cite: 51] and use simple tables or cards to display data like costs and stakeholders. [cite_start]The visual style should be clean, modern, and geometric[cite: 1190]. [cite_start]Imagery: Select professional, high-quality stock photos that align with our brand's focus on technology, e-commerce, and human connection[cite: 1325, 1327]. [cite_start]Images should have a neutral and positive tone[cite: 1333].
    * **Stakeholders Slide:** For the 'Stakeholders' section, create a grid layout. For each stakeholder, display their name, title, and a circular profile image. The images for the stakeholders can be found in the 'Branding Assets' folder. " `; // We wrap this in a Promise.resolve to maintain consistency with other agents return Promise.resolve(prompt);
}

/**
 * Agent 12: Indicative Pricing Packages
 * Generates a templated, three-tiered pricing package section.
 * This agent does not call the API; it constructs a static markdown block
 * with placeholders for manual entry.
 * @returns {Promise<string>} A promise that resolves to the pricing markdown string.
 */
async function indicativePricingAgent() {
    console.log('[Agent 12: Indicative Pricing] Generating pricing package template...');
    const pricingMarkdown = `
## Project Package Options

We offer several packages to meet your specific needs and budget. All pricing is indicative and will be finalized upon completion of the discovery phase.

---

### Package A: Essential
*Standard migration with core features.*
- **Indicative Price:** R [PRICE_ESSENTIAL] (Excl. VAT)
- **Indicative Timeline:** [TIMELINE_ESSENTIAL] weeks
- **Key Features:**
    - ✓ Complete platform migration
    - ✓ Premium theme implementation
    - ✓ Product, customer, and order data migration
    - ✓ Basic SEO preservation & URL redirects
    - ✓ 30 days post-launch support

---

### RECOMMENDED
### Package B: Enhanced
*Advanced features & optimizations for growth.*
- **Indicative Price:** R [PRICE_ENHANCED] (Excl. VAT)
- **Indicative Timeline:** [TIMELINE_ENHANCED] weeks
- **Includes everything in Essential, plus:**
    - ✓ Advanced product filtering & search
    - ✓ Customer review system integration
    - ✓ Email marketing & abandoned cart flows
    - ✓ Advanced SEO & schema markup
    - ✓ 60 days post-launch support

---

### Package C: Premium
*Enterprise-grade solution for market leaders.*
- **Indicative Price:** R [PRICE_PREMIUM] (Excl. VAT)
- **Indicative Timeline:** [TIMELINE_PREMIUM] weeks
- **Includes everything in Enhanced, plus:**
    - ✓ Advanced loyalty program integration
    - ✓ Customer portal enhancements (e.g., wishlists)
    - ✓ A/B testing setup for optimization
    - ✓ Returns portal automation
    - ✓ 90 days priority post-launch support

---

#### Payment Terms
- **40% Initial Payment:** On signed agreement.
- **40% Milestone Payment:** At development milestone.
- **20% Final Payment:** On successful go-live.
`;
    // We wrap this in a Promise.resolve to maintain consistency with other agents
    return Promise.resolve(pricingMarkdown);
}

/**
 * Agent 13: Dynamic Pricing Packages Formatter
 * Takes a pre-processed JSON summary of pricing packages and formats it
 * into a professional, client-facing markdown section.
 * @param {object} pricingSummary The structured JSON object from the pricingDataProcessorAgent.
 * @returns {Promise<string>} A promise that resolves to the formatted markdown string.
 */
async function dynamicPricingPackageAgent(pricingSummary) {
    console.log('[Agent 13: Dynamic Pricing] Formatting processed pricing JSON into markdown...');
    const prompt = `
    You are a Senior Project Manager. You have been given a clean, structured JSON object that summarizes project pricing packages.

    Your task is to format this JSON data into a beautiful and clear markdown section titled "## Project Package Options".

    For each package in the 'pricingPackages' array, you must:
    1.  Create a clear heading for the package (e.g., "### Package A: Essential").
    2.  Include the brief, italicized description.
    3.  List the indicative price and timeline.
    4.  Create a bulleted list of the key features. Use the '✓' checkmark emoji for each feature.
    5.  If 'isRecommended' is true, add a "### RECOMMENDED" heading above the package name.

    After detailing all packages, add a "#### Payment Terms" section with the standard 40% / 40% / 20% breakdown.
    The final output must be clean, well-structured markdown.

    ---
    **Structured Pricing Summary JSON:**
    """
    ${JSON.stringify(pricingSummary, null, 2)}
    """
    `;
    const raw = await generateContentWithRetry(prompt);
    const ourRows = brandContext.stakeholders
        .map(s => `${s.name} | ${s.email} | ${s.title} | ${brandContext.brandName}`)
        .join('\n');

    const lines = raw.split('\n');
    const headerIndex = lines.findIndex(l => l.trim().startsWith('Name |'));
    if (headerIndex !== -1) {
        lines.splice(headerIndex + 1, 0, ...ourRows.split('\n'));
    }
    return lines.join('\n');
}

/**
 * Agent 14: Pricing Data Pre-processor
 * Takes raw pricing data from a Google Sheet and uses the AI to summarize it
 * into a structured JSON object for easier and more efficient use by other agents.
 * @param {Array<Array<string>>} pricingData The raw data from the pricing sheet.
 * @returns {Promise<object>} A promise that resolves to the structured JSON summary of the pricing data.
 */
async function pricingDataProcessorAgent(pricingData) {
    console.log('[Agent 14: Pricing Pre-processor] Summarizing raw pricing data into structured JSON...');
    const prompt = `
    You are a data processing expert. Analyze the following array of pricing data, which was extracted from a spreadsheet. Your task is to convert this raw data into a clean, structured JSON object.

    The JSON object should have a single key, "pricingPackages", which is an array of package objects.

    For each package you identify in the data, create a JSON object with the following keys:
    - "name": The name of the package (e.g., "Essential", "Enhanced").
    - "description": A brief description of the package.
    - "price": The indicative price.
    - "timeline": The estimated timeline for the package.
    - "features": An array of strings, where each string is a key feature of the package.
    - "isRecommended": A boolean value (true/false) if the package is marked as "RECOMMENDED".

    Return ONLY the raw JSON object and nothing else.

    ---
    **Raw Pricing Sheet Data (Array of Arrays):**
    """
    ${JSON.stringify(pricingData, null, 2)}
    """
    `;

    const rawResponse = await generateContentWithRetry(prompt);
    // Reuse the robust JSON parsing logic from the dataIngestionAgent
    try {
        const cleanedString = rawResponse.replace(/^```json\s*|```\s*$/g, '').trim();
        if (!cleanedString) {
            throw new Error("Cleaned string is empty, cannot parse JSON.");
        }
        return JSON.parse(cleanedString);
    } catch (e) {
        console.error("[Agent 14: Pricing Pre-processor] Failed to parse JSON response:", rawResponse);
        throw new Error("Pricing Pre-processor Agent failed to return valid JSON.");
    }
}

// --- MANAGER AGENT / ORCHESTRATOR ---

async function sowOrchestrator(brdText, brandContext) {
    console.log('--- [SOW Orchestrator] Workflow Started ---');
    const sowSections = {}; // Use an object to store sections by name for clarity

    // --- Step 1: Data Ingestion & Pre-processing ---
    console.log('[SOW Orchestrator] Step 1: Ingesting and processing data...');
    const structuredData = await dataIngestionAgent(brdText);
    const rawPricingData = await getPricingSheetData();
    const pricingSummary = await pricingDataProcessorAgent(rawPricingData);
    console.log('[SOW Orchestrator] Data ingestion and processing complete.');

    // --- Step 2: Sequential Agent Execution ---
    // We will now call each agent one by one to avoid overloading the API.

    console.log('[SOW Orchestrator] Step 2.1: Generating Contextual Overview...');
    sowSections.contextualOverview = await contextualOverviewAgent(structuredData);

    console.log('[SOW Orchestrator] Step 2.2: Generating Project Scope...');
    sowSections.projectScope = await projectScopeAgent(structuredData);

    console.log('[SOW Orchestrator] Step 2.3: Generating Stakeholders and Purpose...');
    sowSections.stakeholdersAndPurpose = await stakeholdersAndPurposeAgent(structuredData, brandContext);

    console.log('[SOW Orchestrator] Step 2.4: Generating Dynamic Pricing Packages...');
    sowSections.dynamicPricing = await dynamicPricingPackageAgent(pricingSummary);

    console.log('[SOW Orchestrator] Step 2.5: Generating 3rd Party App List...');
    const appsMarkdown = await thirdPartyAppsAgent(structuredData, rawPricingData);
    sowSections.thirdPartyApps = appsMarkdown;

    console.log('[SOW Orchestrator] Step 2.6: Generating App Cost Summary...');
    sowSections.appCostSummary = await appCostSummaryAgent(appsMarkdown);

    console.log('[SOW Orchestrator] Step 2.7: Generating Pages and Tech Stack...');
    sowSections.pagesAndTech = await pagesAndTechAgent(structuredData);

    console.log('[SOW Orchestrator] Step 2.8: Generating Governance...');
    sowSections.governance = await governanceAgent(structuredData);

    console.log('[SOW Orchestrator] Step 2.9: Generating Project Management and Deliverables...');
    sowSections.projectManagement = await projectManagementAndDeliverablesAgent(structuredData);

    // --- Step 3: Handle Static Agents (No API Call) ---
    // The branding agent does not call the API, so it can be handled separately.
    const clientName = structuredData.ClientProfile?.brandName || 'the Client';
    sowSections.brandingInstructions = await brandingAndGensparkInstructionsAgent(clientName, brandContext);

    // --- Step 4: Assemble the Final Document ---
    console.log('[SOW Orchestrator] All sections generated. Assembling final document...');
    const finalMarkdown = [
        sowSections.contextualOverview,
        sowSections.projectScope,
        sowSections.stakeholdersAndPurpose,
        sowSections.dynamicPricing,
        sowSections.thirdPartyApps,
        sowSections.appCostSummary,
        sowSections.pagesAndTech,
        sowSections.governance,
        sowSections.projectManagement,
        sowSections.brandingInstructions
    ].join('\n\n---\n\n');

    console.log('--- [SOW Orchestrator] Workflow Complete ---');
    return finalMarkdown;
}
// --- Configure Middleware & Routes ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.get('/brandcontext', (req, res) => {
    res.json(brandContext);
});
/**
 * GET /ps/tasks/:runId
 * Returns all tasks for the given workflow run, sorted newest first.
 */
app.get('/ps/tasks/:runId', async (req, res) => {
  const { runId } = req.params;
  // start with first page, sorted newest first
  let nextHref = `${PS_BASE_URL}/workflow-runs/${runId}/tasks?sort=created_at.desc`;
  const allTasks = [];
  try {
    // Loop through pages
    while (nextHref) {
      const pageRes = await fetch(nextHref, {
        headers: { 'X-API-Key': PS_API_KEY }
      });

      if (pageRes.status === 401)   return res.status(401).json({ error: 'Unauthorized' });
      if (pageRes.status === 404)   return res.status(404).json({ error: `Workflow run ${runId} not found` });
      if (!pageRes.ok)              return res.status(pageRes.status).json({ error: pageRes.statusText });

      const { tasks, links } = await pageRes.json();
      allTasks.push(...tasks);

      // find next page link
      const nextLink = links.find(l => l.rel === 'next');
      nextHref = nextLink ? nextLink.href : null;
    }

    // Return the full list
    return res.json(allTasks);

  } catch (err) {
    console.error('❌ Error fetching Process Street tasks:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ps/tasks/:runId/:taskId
 * Fetches one task's form-field values and returns them as Markdown.
 */
app.get('/ps/tasks/:runId/:taskId', async (req, res) => {
  const { runId, taskId } = req.params;

  const taskUrl = `${PS_BASE_URL}/workflow-runs/${runId}/tasks/${taskId}`;
  const fieldsUrl = `${PS_BASE_URL}/workflow-runs/${runId}/tasks/${taskId}/form-fields`;

  try {
    // 1) Verify task exists
    const taskRes = await fetch(taskUrl, {
      headers: { 'X-API-Key': PS_API_KEY }
    });
    if (taskRes.status === 401)   return res.status(401).json({ error: 'Unauthorized' });
    if (taskRes.status === 404)   return res.status(404).json({ error: 'Task not found' });
    if (!taskRes.ok)              return res.status(taskRes.status).json({ error: taskRes.statusText });

    // 2) Fetch all form-field values (handle simple pagination)
    let allFields = [];
    let href = `${fieldsUrl}?_`;
    while (href) {
      const fieldsRes = await fetch(href, {
        headers: { 'X-API-Key': PS_API_KEY }
      });
      if (!fieldsRes.ok) {
        return res.status(fieldsRes.status).json({ error: fieldsRes.statusText });
      }
      const { fields, links } = await fieldsRes.json();
      allFields = allFields.concat(fields);
      const nextLink = links.find(l => l.rel === 'next');
      href = nextLink ? nextLink.href : null;
    }

    // 3) Convert to Markdown
    const md = allFields.map(f => {
      const label = f.label || f.key;
      const data  = f.data;
      let val;
      if (Array.isArray(data)) {
        val = data.join(', ');
      } else if (data && typeof data === 'object') {
        val = JSON.stringify(data);
      } else {
        val = String(data);
      }
      return `**${label}:** ${val}`;
    }).join('\n\n');

    return res.type('text/markdown').send(md);

  } catch (err) {
    console.error('\u274c Error fetching task fields:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ps/runs?workflowId=<templateId>
 * Returns up to 200 latest runs for that workflow template.
 */
app.get('/ps/runs', async (req, res) => {
  const { workflowId } = req.query;
  if (!workflowId) return res.status(400).json({ error: 'workflowId is required' });

  const url = `${PS_BASE_URL}/workflow-runs?workflowId=${encodeURIComponent(workflowId)}`;
  try {
    const psRes = await fetch(url, { headers: { 'X-API-Key': PS_API_KEY } });
    if (!psRes.ok) return res.status(psRes.status).json({ error: psRes.statusText });
    const { workflowRuns } = await psRes.json();
    return res.json(workflowRuns);
  } catch (err) {
    console.error('❌ Error listing workflow runs:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /ps/runs
 * Body: { workflowId: string, name: string, dueDate?: string }
 * Creates a new workflow run and returns its ID.
 */
app.post('/ps/runs', async (req, res) => {
  const { workflowId, name, dueDate } = req.body;
  if (!workflowId || !name) {
    return res.status(400).json({ error: 'workflowId and name are required' });
  }

  const url = `${PS_BASE_URL}/workflow-runs`;
  const payload = { workflowId, name };
  if (dueDate) payload.dueDate = dueDate;

  try {
    const psRes = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': PS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (psRes.status === 401) return res.status(401).json({ error: 'Unauthorized' });
    if (psRes.status === 400) {
      const text = await psRes.text();
      return res.status(400).json({ error: text });
    }
    if (!psRes.ok) return res.status(psRes.status).json({ error: psRes.statusText });

    const { id } = await psRes.json();
    return res.status(201).json({ runId: id });
  } catch (err) {
    console.error('❌ Error creating workflow run:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// Redirect requests to the deprecated HTML page to the new upload endpoint
app.get('/', (req, res) => {
  res.redirect('/upload');
});

app.post('/upload', async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ message: 'No file was uploaded.' });
        }

        const brdFile = req.files.brdFile;
        const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const pdfMimeType = 'application/pdf';

        let brdText; // This variable will hold the extracted text, regardless of file type.

        // Conditional logic to handle different file types
        if (brdFile.mimetype === docxMimeType) {
            console.log(`[File Handler] Processing .docx file: ${brdFile.name}`);
            const { value } = await mammoth.extractRawText({ buffer: brdFile.data });
            brdText = value;

        } else if (brdFile.mimetype === pdfMimeType) {
            console.log(`[File Handler] Processing .pdf file: ${brdFile.name}`);
            const data = await pdf(brdFile.data);
            brdText = data.text;

        } else {
            // Handle invalid file types
            console.error(`Invalid file type uploaded. Expected .docx or .pdf, but got: ${brdFile.mimetype}`);
            return res.status(400).json({
                message: `Invalid file type. Please upload a valid .docx or .pdf file.`,
                error: `Received unsupported file type: ${brdFile.mimetype}.`
            });
        }

        // The rest of the workflow continues unchanged
        const finalSowMarkdown = await sowOrchestrator(brdText, brandContext);

        res.status(200).json({
            message: 'SOW generated successfully!',
            filename: brdFile.name,
            fullSow: finalSowMarkdown
        });

    } catch (error) {
        console.error('Error in the SOW generation workflow:', error);
        res.status(500).json({ message: 'An error occurred during the workflow.', error: error.message });
    }
});

// Endpoint to run the agentic workflow on raw markdown text
app.post('/generate-sow', async (req, res) => {
    try {
        const { markdown } = req.body || {};
        if (!markdown) {
            return res.status(400).json({ message: 'No markdown provided' });
        }

        const generated = await sowOrchestrator(markdown, brandContext);
        res.status(200).json({ markdown: generated });
    } catch (error) {
        console.error('Error generating SOW from markdown:', error);
        res.status(500).json({ message: 'Failed to generate SOW' });
    }
});

// --- Export Endpoints ---
app.post('/export/pdf', async (req, res) => {
    try {
        const { markdown } = req.body || {};
        if (!markdown) {
            return res.status(400).json({ message: 'No markdown provided' });
        }
        const pdfBuf = await mdToPdf({ content: markdown }, {
            stylesheet: path.join(__dirname, 'templates', 'pdf.css'),
            as_buffer: true
        });
        res.contentType('application/pdf');
        res.send(pdfBuf.content);
    } catch (err) {
        console.error('PDF export error:', err);
        res.status(500).json({ message: 'Failed to generate PDF' });
    }
});

app.post('/export/pptx', async (req, res) => {
    try {
        const { markdown } = req.body || {};
        if (!markdown) {
            return res.status(400).json({ message: 'No markdown provided' });
        }

        const slidesMarkdown = markdown.split(/\n---\n/);
        const pptx = new PPTX();
        pptx.layout = 'LAYOUT_WIDE';

        slidesMarkdown.forEach((md) => {
            const slide = pptx.addSlide();
            const lines = md.split(/\n/);
            let y = 0.5;
            lines.forEach(line => {
                if (/^#+/.test(line)) {
                    const level = line.match(/^#+/)[0].length;
                    const text = line.replace(/^#+\s*/, '');
                    slide.addText(text, { x: 0.5, y, fontSize: level === 1 ? 24 : 20, bold: level === 1 });
                    y += 0.6;
                } else if (/^-\s+/.test(line)) {
                    slide.addText(line.replace(/^-\s+/, ''), { x: 0.8, y, fontSize: 14, bullet: true });
                    y += 0.3;
                }
            });

            if (/stakeholders/i.test(md)) {
                brandContext.stakeholders.forEach((s, i) => {
                    const x = 0.5 + (i % 3) * 3;
                    const yPos = 3 + Math.floor(i / 3) * 2.5;
                    if (s.imagePath) {
                        slide.addImage({ path: s.imagePath, x, y: yPos, w: 2, h: 2 });
                    }
                    slide.addText(`${s.name}\n${s.title}`, { x, y: yPos + 2, w: 2, fontSize: 10, align: 'center' });
                });
            }
        });

        const buffer = await pptx.write('nodebuffer');
        res.setHeader('Content-Disposition', 'attachment; filename="sow.pptx"');
        res.send(buffer);
    } catch (err) {
        console.error('PPTX export error:', err);
        res.status(500).json({ message: 'Failed to generate PPTX' });
    }
});

// --- Start the Server ---
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log('Workflow updated with Costing & Estimates agent.');
    });
}

module.exports = app;
