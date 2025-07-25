const assert = require('assert');
process.env.PS_API_KEY = 'test_key';

const page1 = {
  tasks: [{id:1}],
  links: [{ rel:'next', href:'page2' }]
};
const page2 = {
  tasks: [{id:2}],
  links: []
};

let callCount = 0;
global.fetch = async (url, opts) => {
  callCount++;
  if (callCount === 1) return { status:200, ok:true, json:async()=>page1 };
  if (callCount === 2) return { status:200, ok:true, json:async()=>page2 };
};

const app = require('../server');
const handler = app._router.stack
  .find(l=>l.route?.path=='/ps/tasks/:runId').route.stack[0].handle;

(async()=>{
  const req = { params:{ runId:'r1' } };
  let data = null;
  const res = {
    status(code){ this.statusCode=code; return this; },
    json(payload){ data = payload; }
  };

  await handler(req, res);
  assert.deepStrictEqual(data, [{id:1},{id:2}]);
  console.log('✅ /ps/tasks pagination works');
})().catch(e=>{ console.error(e); process.exit(1); });
