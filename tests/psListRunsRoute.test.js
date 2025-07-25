const assert = require('assert');
process.env.PS_API_KEY = 'test_key';

const mockRuns = [{ id: 'r1', name: 'Run 1', updatedDate: '2024-01-01T00:00:00Z' }];

global.fetch = async (url) => {
  assert.ok(url.includes('/workflow-runs?workflowId=w123'));
  return {
    status: 200,
    ok: true,
    json: async () => ({ workflowRuns: mockRuns })
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
  assert.deepStrictEqual(data, mockRuns);
  console.log('✅ /ps/runs list workflow runs works');
})();
