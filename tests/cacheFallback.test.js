const assert = require('assert');
process.env.TOGETHER_API_KEY = 't';
process.env.GEMINI_API_KEY = 'g';

const togetherMock = {
  callCompletion: async () => { throw new Error('fail'); },
  callChatCompletion: async () => { throw new Error('fail'); },
};
require.cache[require.resolve('../services/togetherClient')] = { exports: togetherMock };

const geminiMock = { generateContentWithRetry: async () => '<p>ok</p>' };
require.cache[require.resolve('../services/geminiWrapper')] = { exports: geminiMock };

delete require.cache[require.resolve('../services/aiProvider')];
require('../services/aiProvider');

const { brandContext } = require('../config/brandContext');
const { generateSlidesFromMarkdown } = require('../services/slideGenerator');
const { applySlideEdit } = require('../services/slideEditor');
const { clear } = require('../services/slideCache');

(async () => {
  clear();
  let slides = await generateSlidesFromMarkdown('## F', brandContext);
  assert.strictEqual(slides[0].versionHistory[0].source, 'gemini');
  slides = await generateSlidesFromMarkdown('## F', brandContext);
  assert.ok(slides[0].versionHistory[0].source.startsWith('cache('));

  const slide = slides[0];
  await applySlideEdit(slide, 'up');
  assert.strictEqual(slide.versionHistory[1].source, 'gemini');
  await applySlideEdit(slide, 'up');
  assert.ok(slide.versionHistory.slice(-1)[0].source.startsWith('cache('));
  console.log('✅ fallback generation/edit cached correctly');
})();
