const crypto = require('crypto');

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const SHOW_FULL_PROMPTS = process.env.DEBUG_PROMPTS === 'true';

function logAiUsage({ prompt, source, duration, outputLength }) {
  if (SHOW_FULL_PROMPTS) {
    console.info(`[AI_PROMPT] ${prompt}`);
  }
  const promptField = SHOW_FULL_PROMPTS ? `Prompt` : `PromptHash`;
  const promptValue = SHOW_FULL_PROMPTS ? prompt.replace(/\s+/g, ' ') : hash(prompt);
  console.info(`[AI] ${promptField}=${promptValue} Source=${source} DurationMs=${duration} OutputLength=${outputLength}`);
}

let cacheHits = 0;
let cacheMisses = 0;

function logCacheMetric({ hit, type }) {
  if (hit) cacheHits++; else cacheMisses++;
  const outcome = hit ? 'hit' : 'miss';
  console.info(`[Cache] ${type} ${outcome}`);
}

function getCacheMetrics() {
  return { cacheHits, cacheMisses };
}

function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
}

module.exports = { hash, logAiUsage, logCacheMetric, getCacheMetrics, resetCacheMetrics };
