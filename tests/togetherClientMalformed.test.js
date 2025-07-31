const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';

(async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  const { callCompletion, callChatCompletion } = require('../services/togetherClient');
  try {
    await callCompletion({ prompt: 'x' });
    console.error('completion should fail');
    process.exit(1);
  } catch (err) {
    assert.strictEqual(err.message, 'Malformed Together.ai completion response');
  }

  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{}] }) });
  try {
    await callChatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    console.error('chat should fail');
    process.exit(1);
  } catch (err) {
    assert.strictEqual(err.message, 'Malformed Together.ai chat response');
    console.log('✅ togetherClient handles malformed responses');
  }
})();
