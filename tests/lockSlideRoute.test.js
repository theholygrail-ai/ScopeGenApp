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
  const revert = getHandler('/slides/:slideId/revert');
  const lock = getHandler('/slides/:slideId/lock');
  const unlock = getHandler('/slides/:slideId/unlock');
  const fetchOne = getHandler('/slides/:slideId');

  let data;
  await gen({ body: { fullSow: '## Slide 1\nA' } }, { json: d => { data = d; }, status(){ return this; } });
  const slideId = data.slides[0].id;

  await lock({ params: { slideId } }, { json() {}, status(){ return this; } });
  let slide;
  await fetchOne({ params:{ slideId } }, { json: d => { slide = d.slide; }, status(){ return this; } });
  assert.strictEqual(slide.isLocked, true);
  assert.ok(slide.finalizedAt instanceof Date);

  const conflict = { statusCode:null, json(){}, status(c){ this.statusCode=c; return this; } };
  await edit({ params:{ slideId }, body:{ instruction:'x' } }, conflict);
  assert.strictEqual(conflict.statusCode, 409);
  await revert({ params:{ slideId }, body:{ versionIndex:0 } }, conflict);
  assert.strictEqual(conflict.statusCode, 409);

  await unlock({ params:{ slideId } }, { json() {}, status(){ return this; } });
  await revert({ params:{ slideId }, body:{ versionIndex:0 } }, { json(){}, status(){ return this; } });
  console.log('✅ lock/unlock persistence and guards work');
})();
