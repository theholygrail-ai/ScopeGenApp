const { generateWithFallback } = require('./aiProvider');
const { DEFAULT_MODEL } = require('./togetherClient');
const { sanitizeHtmlFragment, buildSlidePrompt } = require('./slideGenerator');
const { makeCacheKey, get: cacheGet, set: cacheSet } = require('./slideCache');
const { logAiUsage, logCacheMetric, hash } = require('../utils/logging');

async function* generateSlidesAgentically(slideSpecs, brandContext) {
  for (const slide of slideSpecs) {
    const prompt = buildSlidePrompt(slide.originalMarkdown, brandContext);
    const cacheKey = makeCacheKey({
      slideMarkdown: slide.originalMarkdown,
      brandingContext: brandContext,
      instruction: 'initial',
      model: DEFAULT_MODEL,
    });
    const cached = cacheGet(cacheKey);
    if (cached) {
      slide.versionHistory.push({ html: slide.currentHtml, timestamp: Date.now(), source: `cache(${cached.metadata.model})` });
      slide.currentHtml = cached.html;
      slide.versionNumber = slide.versionHistory.length;
      logCacheMetric({ hit: true, type: 'generate' });
      slide.chatHistory.push({ role: 'assistant', content: cached.html });
      yield slide;
      continue;
    }

    const start = Date.now();
    const { text, source } = await generateWithFallback(prompt, { max_tokens: 1500 });
    const duration = Date.now() - start;
    const sanitized = sanitizeHtmlFragment(text);
    slide.versionHistory.push({ html: slide.currentHtml, timestamp: Date.now(), source });
    slide.currentHtml = sanitized;
    slide.versionNumber = slide.versionHistory.length;
    logAiUsage({ prompt, source, duration, outputLength: (text || '').length });
    logCacheMetric({ hit: false, type: 'generate' });
    slide.chatHistory.push({ role: 'assistant', content: sanitized });
    cacheSet(cacheKey, sanitized, { model: source, promptHash: hash(prompt), branding: brandContext });
    yield slide;
  }
}

module.exports = { generateSlidesAgentically };
