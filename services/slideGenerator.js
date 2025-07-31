const { generateWithFallback } = require('./aiProvider');
const { logAiUsage } = require('../utils/logging');
const crypto = require('crypto');
let sanitizeHtml;
try {
  sanitizeHtml = require('sanitize-html');
} catch {
  sanitizeHtml = null;
}

function makeSlideId(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
}

function chunkSowMarkdown(fullMarkdown) {
  const rawSlides = fullMarkdown.split(/\n---\n/);
  return rawSlides.map(md => {
    const titleMatch = md.match(/^#{1,3}\s*(.+)$/m);
    return {
      id: `slide-${makeSlideId(md)}`,
      title: titleMatch ? titleMatch[1].trim() : 'Untitled Slide',
      originalMarkdown: md.trim(),
      currentHtml: null,
      versionHistory: [],
      chatHistory: [],
    };
  });
}

function sanitizeHtmlFragment(html) {
  if (!html) return '';
  if (sanitizeHtml) {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        '*': ['class', 'style', 'href', 'src', 'alt']
      }
    });
  }
  // Fallback regex-based sanitization if sanitize-html isn't available
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '');
}

function buildSlidePrompt(slideMarkdown, brandContext) {
  return `
You are a professional presentation designer. Convert the following Markdown content into a single HTML slide. 
Use Tailwind CSS utility classes for clean, modern styling consistent with the brand. 
Output only the HTML snippet. Do not include explanations or markdown.

Branding:
- Brand Name: ${brandContext.brandName}
- Tagline: ${brandContext.tagline}
- Primary font: ${brandContext.fonts.primary} (fallback: ${brandContext.fonts.websafe})
- Primary color: ${brandContext.palette.digitalTide}
- Use responsive layout and semantic HTML.

Requirements:
* Headings should be prominent using Tailwind classes (e.g., text-2xl font-bold, mb-4).
* Lists should be styled with appropriate spacing and custom bullet (you can use icons or styled list markers).
* Include spacing between sections (e.g., use mb-6, p-4).
* If the slide contains stakeholder information, format it as a responsive grid.
* Avoid inline scripts. Only use Tailwind utility classes.
* Keep markup minimal but visually clear.

Slide content:
${slideMarkdown}
  `;
}

async function generateSlidesFromMarkdown(fullMarkdown, brandContext) {
  const slides = chunkSowMarkdown(fullMarkdown);
  for (const slide of slides) {
    const prompt = buildSlidePrompt(slide.originalMarkdown, brandContext);
    const start = Date.now();
    const { text, source } = await generateWithFallback(prompt, { max_tokens: 1500 });
    const duration = Date.now() - start;
    const sanitized = sanitizeHtmlFragment(text);
    slide.versionHistory.push({ html: slide.currentHtml, timestamp: Date.now(), source });
    slide.currentHtml = sanitized;
    logAiUsage({ prompt, source, duration, outputLength: (text || '').length });
    slide.chatHistory.push({ role: 'assistant', content: sanitized });
  }
  return slides;
}

module.exports = {
  chunkSowMarkdown,
  sanitizeHtmlFragment,
  buildSlidePrompt,
  generateSlidesFromMarkdown,
};
