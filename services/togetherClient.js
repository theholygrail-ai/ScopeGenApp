/**
 * Together.ai API wrapper providing completion and chat APIs with
 * exponential backoff retry logic. Requires TOGETHER_API_KEY and
 * optional TOGETHER_API_BASE environment variables which are loaded
 * in ../config/aiConfig.js.
 */
const fetch = require('../utils/fetcher');
const { together } = require('../config/aiConfig');

const DEFAULT_MODEL = 'Qwen/Qwen2.5-Coder-32B-Instruct';

function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

async function retryWithBackoff(fn, { retries = 3, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const last = attempt === retries;
      console.warn(`[TogetherClient] Attempt ${attempt + 1} failed${last ? ' (giving up)' : ''}:`, err.message);
      if (last) throw err;
      const backoff = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(res => setTimeout(res, backoff));
    }
  }
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${together.apiKey}`,
  };
}

async function callCompletion({
  model = DEFAULT_MODEL,
  prompt,
  max_tokens = 1500,
  temperature = 0.7,
  stop = null,
}) {
  if (!prompt) throw new Error('Prompt is required for callCompletion');

  const body = { model, prompt, max_tokens, temperature };
  if (stop) body.stop = stop;

  const fn = async () => {
    const res = await fetchWithTimeout(`${together.base}/v1/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Together.ai completion error: ${res.status} - ${text}`);
    }
    const data = await res.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error('Malformed Together.ai completion response');
    }
    return data.choices[0].text;
  };

  return retryWithBackoff(fn);
}

async function callChatCompletion({
  model = DEFAULT_MODEL,
  messages,
  max_tokens = 1500,
  temperature = 0.7,
  stream = false,
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array required for chat completion');
  }

  const body = { model, messages, max_tokens, temperature, stream };

  const fn = async () => {
    const res = await fetchWithTimeout(`${together.base}/v1/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Together.ai chat error: ${res.status} - ${text}`);
    }
    const data = await res.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error('Malformed Together.ai chat response');
    }
    return data.choices[0].message.content;
  };

  return retryWithBackoff(fn);
}

module.exports = { callCompletion, callChatCompletion, DEFAULT_MODEL };
