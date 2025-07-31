const assert = require('assert');
process.env.TOGETHER_API_KEY = 't';
process.env.GEMINI_API_KEY = 'g';

const mockPool = require('./mockPool');
require.cache[require.resolve('../services/db')] = { exports: { pool: mockPool } };

const aiMock = {
  generateWithFallback: async () => ({ source: 'mock', text: '<p>orig</p>' }),
  editWithFallback: async () => ({ source: 'mock', text: '<p>edited</p>' })
};
require.cache[require.resolve('../services/aiProvider')] = { exports: aiMock };

const app = require('../server');
const getHandler = p => app._router.stack.find(r => r.route && r.route.path === p).route.stack[0].handle;

(async () => {
  const gen = getHandler('/slides/generate');
  const edit = getHandler('/slides/:slideId/edit');
  const versions = getHandler('/slides/:slideId/versions');
  const revert = getHandler('/slides/:slideId/revert');
  const fetchOne = getHandler('/slides/:slideId');
  const exportHtml = getHandler('/slides/export/html/:runId');
  const exportPptx = getHandler('/export/pptx/run/:runId');

  // generate slides
  let genData;
  await gen({ body: { fullSow: '## Slide 1\nA' } }, { json: d => { genData = d; }, status() { return this; } });
  const runId = genData.runId;
  const slideId = genData.slides[0].id;
  assert.strictEqual(genData.slides[0].versionNumber, 1);

  // edit
  await edit({ params: { slideId }, body: { instruction: 'change' } }, { json() {}, status() { return this; } });

  // versions
  let ver;
  await versions({ params: { slideId } }, { json: d => { ver = d; }, status() { return this; } });
  assert.strictEqual(ver.versions.length, 2);

  // revert
  await revert({ params: { slideId }, body: { versionIndex: 0 } }, { json() {}, status() { return this; } });

  // fetch single
  let single;
  await fetchOne({ params: { slideId } }, { json: d => { single = d; }, status() { return this; } });
  assert.strictEqual(single.slide.versionNumber, 3);
  assert.strictEqual(single.slide.versionHistory.length, 3);

  // export html
  let html = '';
  await exportHtml({ params: { runId } }, { setHeader() {}, send: h => { html = h; }, status() { return this; }, json() {} });
  assert(html.includes('<p>orig</p>'));

  // export pptx
  let pptBuf;
  await exportPptx({ params: { runId } }, { setHeader() {}, send: b => { pptBuf = b; }, status() { return this; }, json() {} });
  assert.ok(Buffer.isBuffer(pptBuf));
  assert.ok(pptBuf.length > 0);
  assert.ok(pptBuf.toString().includes('Slide 1'));

  console.log('✅ slides integration flow works');
})();
