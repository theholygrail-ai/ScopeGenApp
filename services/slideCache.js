const crypto = require('crypto');
const cache = new Map();

function makeCacheKey({ slideMarkdown, brandingContext, instruction = 'initial', model }) {
  const payload = JSON.stringify({ slideMarkdown, brandingContext, instruction, model });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function get(key) {
  return cache.get(key);
}

function set(key, html, metadata = {}) {
  cache.set(key, { html, metadata, cachedAt: Date.now() });
}

function clear() {
  cache.clear();
}

module.exports = { makeCacheKey, get, set, clear };
