const assert = require('assert');

const mockTasks = [{id:1},{id:2}];
async function mockFetch() {
  return {
    status: 200,
    ok: true,
    json: async () => ({ tasks: mockTasks })
  };
}

global.fetch = mockFetch;
process.env.PS_API_KEY = "test_key";
const app = require("../server");

async function run() {
  const layer = app._router.stack.find(s => s.route && s.route.path === '/ps/tasks/:runId').route.stack[0].handle;
  const req = { params: { runId: '123' } };
  const res = {
    statusCode: 200,
    data: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; }
  };
  await layer(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.data, mockTasks);
  console.log('ps tasks route returns tasks');
}

run().catch(err => { console.error(err); process.exit(1); });
