const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'gem';

// Mock aiProvider functions
const aiMock = {
  editWithFallback: async () => ({ source: 'mock', text: '<div onclick="a()">ok</div>' }),
  generateWithFallback: async () => ({ source: 'mock', text: '• old edit' })
};
require.cache[require.resolve('../services/aiProvider')] = { exports: aiMock };

const { applySlideEdit, revertSlideToVersion } = require('../services/slideEditor');

(async () => {
  const slide = { id:'s1', title:'', originalMarkdown:'', currentHtml:'<p>old</p>', versionHistory:[], chatHistory:[] };
  const updated = await applySlideEdit(slide, 'change header');
  assert.strictEqual(updated.currentHtml, '<div >ok</div>');
  assert.strictEqual(updated.versionHistory.length, 1);
  assert.strictEqual(updated.chatHistory.length, 2);

  const reverted = revertSlideToVersion(updated, 0);
  assert.strictEqual(reverted.currentHtml, '<p>old</p>');
  assert.strictEqual(reverted.versionHistory.length, 2);
  console.log('✅ slideEditor apply and revert work');
})();

(async () => {
  const slide = { id:'s2', title:'', originalMarkdown:'', currentHtml:'<p>x</p>', versionHistory:[], chatHistory:[] };
  for (let i=0;i<9;i++) slide.chatHistory.push({ role:'user', content:'msg'+i });
  await applySlideEdit(slide, 'update');
  assert.strictEqual(slide.chatHistory[0].role, 'system');
  console.log('✅ slideEditor summarization works');
})();
