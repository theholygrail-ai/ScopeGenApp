const assert = require('assert');
const mockPool = require('./mockPool');
require.cache[require.resolve('../services/db')] = { exports: { pool: mockPool } };

const {
  createRunWithSlides,
  persistSlideEdit,
  getSlidesByRun,
  getSlideWithHistory,
} = require('../services/slidePersistence');

function revertSlideToVersion(slide, versionIndex) {
  if (versionIndex < 0 || versionIndex >= slide.versionHistory.length) {
    throw new Error('Invalid version index');
  }
  const version = slide.versionHistory[versionIndex];
  slide.versionHistory.push({
    html: slide.currentHtml,
    timestamp: Date.now(),
    source: 'revert',
    instruction: `Reverted to version ${versionIndex}`,
  });
  slide.currentHtml = version.html;
  return slide;
}

(async () => {
  const slides = [
    {
      id: 's1',
      title: 'Slide 1',
      originalMarkdown: 'one',
      currentHtml: '<p>1</p>',
      versionHistory: [{ html: '<p>1</p>', source: 'init', instruction: 'initial generation' }],
      chatHistory: [],
    },
    {
      id: 's2',
      title: 'Slide 2',
      originalMarkdown: 'two',
      currentHtml: '<p>2</p>',
      versionHistory: [{ html: '<p>2</p>', source: 'init', instruction: 'initial generation' }],
      chatHistory: [],
    },
  ];

  const runId = await createRunWithSlides('full md', slides, null);
  assert.strictEqual(runId, 1);

  let stored = await getSlidesByRun(runId);
  assert.strictEqual(stored.length, 2);
  assert.strictEqual(stored[0].versionNumber, 1);

  await persistSlideEdit('s1', '<p>a1</p>', 'mock', 'edit1');
  let slide = await getSlideWithHistory('s1');
  assert.strictEqual(slide.currentHtml, '<p>a1</p>');
  assert.strictEqual(slide.versionNumber, 2);
  assert.strictEqual(slide.versionHistory.length, 2);

  await persistSlideEdit('s1', '<p>a2</p>', 'mock', 'edit2');
  slide = await getSlideWithHistory('s1');
  assert.strictEqual(slide.versionNumber, 3);

  // revert to version 0
  const revertedObj = revertSlideToVersion(slide, 0);
  await persistSlideEdit('s1', revertedObj.currentHtml, 'revert', 'revert to v1');
  slide = await getSlideWithHistory('s1');
  assert.strictEqual(slide.currentHtml, '<p>1</p>');
  assert.strictEqual(slide.versionNumber, 4);
  assert.strictEqual(slide.versionHistory.length, 4);

  console.log('✅ slidePersistence operations work');
})();
