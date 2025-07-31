const assert = require('assert');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
assert(GEMINI_API_KEY, 'Missing GEMINI_API_KEY in environment');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateContentWithRetry(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.warn(`Gemini attempt ${i + 1} failed.`, error.message);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

module.exports = { generateContentWithRetry };
