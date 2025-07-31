const assert = require('assert');
process.env.TOGETHER_API_KEY = 't';
process.env.GEMINI_API_KEY = 'g';

let genCalls = 0;
let editCalls = 0;
const aiMock = {
  generateWithFallback: async () => { genCalls++; return { source:'mock', text:'<p>gen</p>' }; },
  editWithFallback: async () => { editCalls++; return { source:'mock', text:'<p>edit</p>' }; }
};
require.cache[require.resolve('../services/aiProvider')] = { exports: aiMock };

const { brandContext } = require('../config/brandContext');
const { generateSlidesFromMarkdown } = require('../services/slideGenerator');
const { applySlideEdit } = require('../services/slideEditor');
const { clear } = require('../services/slideCache');

(async () => {
  clear();
  genCalls = 0;
  let slides = await generateSlidesFromMarkdown('## S1\nA', brandContext);
  assert.strictEqual(genCalls, 1);
  slides = await generateSlidesFromMarkdown('## S1\nA', brandContext);
  assert.strictEqual(genCalls, 1);
  assert.strictEqual(slides[0].versionHistory[0].source, 'cache');

  const slide = slides[0];
  editCalls = 0;
  await applySlideEdit(slide, 'change');
  assert.strictEqual(editCalls, 1);
  await applySlideEdit(slide, 'change');
  assert.strictEqual(editCalls, 1);
  assert.strictEqual(slide.versionHistory.slice(-1)[0].source, 'cache');
  console.log('✅ cache hit works for generation and edit');
})();
