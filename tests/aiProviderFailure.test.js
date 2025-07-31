const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'gem';

const togetherMock = {
  callCompletion: async () => { throw new Error('tfail'); },
  callChatCompletion: async () => { throw new Error('tfail'); },
};
require.cache[require.resolve('../services/togetherClient')] = { exports: togetherMock };

const geminiMock = { generateContentWithRetry: async () => { throw new Error('gfail'); } };
require.cache[require.resolve('../services/geminiWrapper')] = { exports: geminiMock };

const { generateWithFallback, editWithFallback } = require('../services/aiProvider');

(async () => {
  try {
    await generateWithFallback('hi');
    console.error('generate should fail');
    process.exit(1);
  } catch (err) {
    assert.strictEqual(err.message, 'gfail');
  }

  try {
    await editWithFallback([{ role: 'user', content: 'hi' }]);
    console.error('edit should fail');
    process.exit(1);
  } catch (err) {
    assert.strictEqual(err.message, 'gfail');
    console.log('✅ aiProvider bubbles gemini failure');
  }
})();
