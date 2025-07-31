const crypto = require('crypto');

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function logAiUsage({ prompt, source, duration, outputLength }) {
  console.info(`[AI] PromptHash=${hash(prompt)} Source=${source} DurationMs=${duration} OutputLength=${outputLength}`);
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
