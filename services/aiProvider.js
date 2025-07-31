/**
 * Provider-agnostic AI interface. Tries Together.ai first and falls
 * back to Gemini on failure. Exposes generateWithFallback and
 * editWithFallback for use by agents.
 */
const { callCompletion, callChatCompletion } = require('./togetherClient');
const { generateContentWithRetry: geminiGenerate } = require('./geminiWrapper');

async function generateWithFallback(prompt, options = {}) {
  try {
    const text = await callCompletion({ prompt, ...options });
    return { source: 'together', text };
  } catch (err) {
    console.warn('[AIProvider] Together.ai failed, falling back to Gemini:', err.message);
    const text = await geminiGenerate(prompt);
    return { source: 'gemini', text };
  }
}

async function editWithFallback(messages, options = {}) {
  try {
    const text = await callChatCompletion({ messages, ...options });
    return { source: 'together', text };
  } catch (err) {
    console.warn('[AIProvider] Together.ai chat edit failed, falling back to Gemini');
    const lastUser = messages.filter(m => m.role === 'user').slice(-1)[0];
    const prompt = lastUser ? lastUser.content : '';
    const text = await geminiGenerate(prompt);
    return { source: 'gemini', text };
  }
}

module.exports = { generateWithFallback, editWithFallback };
