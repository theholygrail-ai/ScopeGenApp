// Loads and validates configuration for Together.ai credentials.
const assert = require('assert');

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const TOGETHER_API_BASE = process.env.TOGETHER_API_BASE || 'https://api.together.ai';

assert(TOGETHER_API_KEY, 'Missing TOGETHER_API_KEY in environment');

module.exports = {
  together: {
    apiKey: TOGETHER_API_KEY,
    base: TOGETHER_API_BASE,
  },
};
