const assert = require('assert');
process.env.PS_API_KEY = 'test_key';
const mockFields = [
  { label:'Name', data:'ACME Corp' },
  { label:'Deadline', data:'2025-08-10T00:00:00Z' }
];
// 1) Mock the task existence call
let callCount = 0;
global.fetch = async (url, opts) => {
  callCount++;
  if (callCount === 1) {
    // task metadata
    return { status:200, ok:true, json:async()=>({id:'t1'}) };
  } else {
    // form-fields pages
    return {
      status:200, ok:true,
      json:async()=>({
        fields: mockFields,
        links: []  // no pagination
      })
    };
  }
};

const app = require('../server');
const handler = app._router.stack
  .find(l=>l.route?.path=='/ps/tasks/:runId/:taskId').route.stack[0].handle;

(async()=>{
  const req = { params:{ runId:'r1', taskId:'t1' } };
  let sent = '';
  const res = {
    headers:{},
    type(ct){ this.headers['content-type']=ct; return this; },
    send(payload){ sent = payload; }
  };
  await handler(req, res);
  // Expect Markdown with both fields:
  assert(sent.includes('**Name:** ACME Corp'));
  assert(sent.includes('**Deadline:** 2025-08-10T00:00:00Z'));
  console.log('✅ Single-task Markdown route works');
})().catch(e=>{ console.error(e); process.exit(1); });
