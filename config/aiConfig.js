// Loads and validates configuration for Together.ai credentials.
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || 'test';
const TOGETHER_API_BASE = process.env.TOGETHER_API_BASE || 'https://api.together.ai';

module.exports = {
  together: {
    apiKey: TOGETHER_API_KEY,
    base: TOGETHER_API_BASE,
  },
};
