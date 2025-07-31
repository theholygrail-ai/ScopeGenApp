const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';

let callCount = 0;

global.fetch = async () => {
  callCount += 1;
  if (callCount === 1) {
    return { ok: false, status: 500, text: async () => 'err' };
  }
  return { ok: true, json: async () => ({ choices: [{ text: 'ok' }] }) };
};

const { callCompletion } = require('../services/togetherClient');

(async () => {
  const res = await callCompletion({ prompt: 'test', max_tokens: 5 });
  assert.strictEqual(res, 'ok');
  assert.strictEqual(callCount, 2);
  console.log('✅ togetherClient retries and succeeds');
})().catch(err => { console.error(err); process.exit(1); });
