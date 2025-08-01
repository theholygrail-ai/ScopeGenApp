const crypto = require('crypto');
const stableStringify = require('../utils/stableStringify');

const cache = new Map();
const TTL_MS = parseInt(process.env.CACHE_TTL_MS, 10) || 60 * 60 * 1000;

function stripPriv(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripPriv);
  return Object.keys(obj).reduce((acc,k)=>{
    if(!k.startsWith('__')) acc[k]=stripPriv(obj[k]);
    return acc;
  },{});
}

function makeCacheKey({ slideMarkdown, brandingContext, instruction = 'initial', model }) {
  const { brandName, tagline, palette, fonts, logoPaths, imagery, stakeholders } = brandingContext || {};
  const cleanCtx = stripPriv({ brandName, tagline, palette, fonts, logoPaths, imagery, stakeholders });
  const payload = stableStringify({ slideMarkdown, brandingContext: cleanCtx, instruction, model });
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
