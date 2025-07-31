const assert = require('assert');
const mockPool = require('./mockPool');
require.cache[require.resolve('../services/db')] = { exports: { pool: mockPool } };

const {
  createRunWithSlides,
  getSlideWithHistory,
  persistSlideEdit,
  lockSlide,
  unlockSlide,
} = require('../services/slidePersistence');
const { applySlideEdit, revertSlideToVersion } = require('../services/slideEditor');
const { withSlideLock } = require('../services/slideMutationQueue');

(async () => {
  const slides = [
    {
      id: 's1',
      title: 'Slide 1',
      originalMarkdown: 'one',
      currentHtml: '<p>initial</p>',
      versionHistory: [{ html: '<p>initial</p>', source: 'init', instruction: 'initial generation' }],
      chatHistory: [],
    },
  ];
  const runId = await createRunWithSlides('md', slides, null);
  assert.strictEqual(runId, 1);

  const slideBefore = await getSlideWithHistory('s1');
  const p1 = withSlideLock('s1', async () => {
    const updated = await applySlideEdit(slideBefore, 'first edit');
    await persistSlideEdit('s1', updated.currentHtml, 'mock', 'first edit', null);
    return updated;
  });

  const p2 = withSlideLock('s1', async () => {
    const slideNow = await getSlideWithHistory('s1');
    const updated = await applySlideEdit(slideNow, 'second edit');
    await persistSlideEdit('s1', updated.currentHtml, 'mock', 'second edit', null);
    return updated;
  });

  const p3 = withSlideLock('s1', async () => {
    const slideNow = await getSlideWithHistory('s1');
    const reverted = revertSlideToVersion(slideNow, 0);
    await persistSlideEdit('s1', reverted.currentHtml, 'revert', 'revert to initial', null);
    return reverted;
  });

  await Promise.all([p1, p2, p3]);

  const final = await getSlideWithHistory('s1');
  assert.strictEqual(final.versionHistory.length, 4);
  assert.strictEqual(final.currentHtml, '<p>initial</p>');
  console.log('✅ slide mutation queue serializes concurrent operations correctly');
})();
