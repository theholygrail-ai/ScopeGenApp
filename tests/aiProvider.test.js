const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'gem';

// Mock togetherClient to fail
const togetherMock = {
  callCompletion: async () => { throw new Error('fail'); },
  callChatCompletion: async () => { throw new Error('fail'); },
};
require.cache[require.resolve('../services/togetherClient')] = { exports: togetherMock };

// Mock gemini wrapper to return success
const geminiMock = {
  generateContentWithRetry: async (p) => `gem:${p}`,
};
require.cache[require.resolve('../services/geminiWrapper')] = { exports: geminiMock };

const { generateWithFallback, editWithFallback } = require('../services/aiProvider');

(async () => {
  const g = await generateWithFallback('hi');
  assert.deepStrictEqual(g, { source: 'gemini', text: 'gem:hi' });

  const c = await editWithFallback([{ role: 'user', content: 'u' }]);
  assert.deepStrictEqual(c, { source: 'gemini', text: 'gem:u' });
  console.log('✅ aiProvider falls back to gemini');
})().catch(err => { console.error(err); process.exit(1); });
