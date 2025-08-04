const assert = require('assert');
process.env.PS_API_KEY = 'test_key';

global.fetch = async (url) => {
  assert.ok(url.includes('/workflow-runs?workflowId=w123'));
  return {
    status: 204,
    ok: true,
  };
};

const app = require('../server');
const handler = app._router.stack
  .find(l => l.route?.path === '/ps/runs' && l.route.methods.get)
  .route.stack[0].handle;

(async () => {
  const req = { query: { workflowId: 'w123' } };
  let data = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { data = payload; }
  };

  await handler(req, res);
  assert.strictEqual(res.statusCode, undefined); // default 200
  assert.deepStrictEqual(data, []);
  console.log('✅ /ps/runs returns empty array when no runs exist');
})();
