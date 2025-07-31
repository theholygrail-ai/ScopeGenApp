const assert = require('assert');
const { diffHtml } = require('../utils/diff');

(() => {
  const diff = diffHtml('<p>hello world</p>', '<p>hello there</p>');
  const added = diff.find(p => p.added);
  const removed = diff.find(p => p.removed);
  assert(added && added.value.includes('there'));
  assert(removed && removed.value.includes('world'));
  console.log('✅ diff util works');
})();
