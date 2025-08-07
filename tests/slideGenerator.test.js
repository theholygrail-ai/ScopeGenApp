const assert = require('assert');
process.env.TOGETHER_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'gem';

// Mock aiProvider to return simple HTML
const aiMock = {
  generateWithFallback: async () => ({ source: 'mock', text: '<h1 class="text-2xl">Title</h1>' })
};
require.cache[require.resolve('../services/aiProvider')] = { exports: aiMock };

const { brandContext } = require('../config/brandContext');
const { generateSlidesFromMarkdown, chunkSowMarkdown, sanitizeHtmlFragment } = require('../services/slideGenerator');

(async () => {
  const md = '## Slide One\nContent\n\n---\n\n## Slide Two\nMore';
  const slides = await generateSlidesFromMarkdown(md, brandContext);
  assert.strictEqual(slides.length, 2);
  assert.ok(slides[0].currentHtml.includes('text-2xl'));
  assert.strictEqual(slides[0].versionHistory.length, 1);

  const chunks = chunkSowMarkdown(md);
  assert.strictEqual(chunks[0].title, 'Slide One');

  const unsafe = '<div onclick="alert(1)">x<script>bad()</script></div>';
  const clean = sanitizeHtmlFragment(unsafe);
  assert(!clean.includes('script'));
  assert(!/onclick/.test(clean));
  console.log('✅ slideGenerator works');
})();

(async () => {
  const fenced = '```html\n<div>ok</div>\n```';
  const withPrefix = 'html\n<p>test</p>';
  assert.strictEqual(sanitizeHtmlFragment(fenced), '<div>ok</div>');
  assert.strictEqual(sanitizeHtmlFragment(withPrefix), '<p>test</p>');
  console.log('✅ sanitizer strips fences');
})();

(async () => {
  const trailing = '```html\n<div>ok</div>\n```\nHere is more info';
  const preceding = 'Take this:\n```html\n<div>ok</div>\n```';
  const unclosed = '```html\n<div>ok</div>\nExtra words';
  const sameLine = '<div>ok</div> thanks';
  assert.strictEqual(sanitizeHtmlFragment(trailing), '<div>ok</div>');
  assert.strictEqual(sanitizeHtmlFragment(preceding), '<div>ok</div>');
  assert.strictEqual(sanitizeHtmlFragment(unclosed), '<div>ok</div>');
  assert.strictEqual(sanitizeHtmlFragment(sameLine), '<div>ok</div>');
  console.log('✅ sanitizer handles model variants');
})();
