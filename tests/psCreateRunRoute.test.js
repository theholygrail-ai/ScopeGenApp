const assert = require('assert');
process.env.PS_API_KEY = 'test_key';

const mockResponse = { id: 'newRun123' };
global.fetch = async (url, opts) => {
  // Ensure correct URL and payload
  assert.strictEqual(url.endsWith('/workflow-runs'), true);
  const body = JSON.parse(opts.body);
  assert.strictEqual(body.workflowId, 'w123');
  assert.strictEqual(body.name, 'My BRD Run');
  return {
    status: 201,
    ok: true,
    json: async () => mockResponse
  };
};

const app = require('../server');
const handler = app._router.stack
  .find(l => l.route?.path === '/ps/runs' && l.route.methods.post)
  .route.stack[0].handle;

(async () => {
  const req = { body: { workflowId: 'w123', name: 'My BRD Run' } };
  let data = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { data = payload; }
  };

  await handler(req, res);
  assert.strictEqual(res.statusCode, 201);
  assert.deepStrictEqual(data, { runId: 'newRun123' });
  console.log('✅ /ps/runs create-workflow-run route works');
})().catch(err => { console.error(err); process.exit(1); });
