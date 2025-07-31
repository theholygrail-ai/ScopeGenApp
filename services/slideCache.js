const crypto = require('crypto');
const stableStringify = require('../utils/stableStringify');

const cache = new Map();
const TTL_MS = parseInt(process.env.CACHE_TTL_MS, 10) || 60 * 60 * 1000;

function makeCacheKey({ slideMarkdown, brandingContext, instruction = 'initial', model }) {
  const payload = stableStringify({ slideMarkdown, brandingContext, instruction, model });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function get(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function set(key, html, metadata = {}) {
  cache.set(key, { html, metadata, cachedAt: Date.now() });
}

function clear() {
  cache.clear();
}

module.exports = { makeCacheKey, get, set, clear };
