const { editWithFallback, generateWithFallback } = require('./aiProvider');
const { sanitizeHtmlFragment } = require('./slideGenerator');
const { logAiUsage, logCacheMetric, hash } = require('../utils/logging');
const { makeCacheKey, get: cacheGet, set: cacheSet } = require('./slideCache');
const { DEFAULT_MODEL } = require('./togetherClient');
const { brandContext } = require('../config/brandContext');

function shouldCondense(history) {
  return Array.isArray(history) && history.length > 8;
}

async function condenseChatHistoryIfNeeded(slide) {
  if (!shouldCondense(slide.chatHistory)) return;

  const lastTwo = slide.chatHistory.slice(-2);
  const earlier = slide.chatHistory.slice(0, -2);

  const styleRubric =
    'Style Rubric: Headings should be prominent using Tailwind (e.g., text-2xl font-bold), lists use proper spacing/bullets, responsive layout, no inline scripts, and clean semantic HTML.';

  const fewShotExample = `\nExample:\nuser: Change the header to be larger and blue.\nassistant: <div class="text-2xl font-bold text-blue-600">Title</div>\nuser: Convert bullet list to checkmarks.\nassistant: <ul class="list-disc">...</ul>\n\nSummary of earlier changes should look like:\n- Made header larger and blue.\n- Converted bullet list to checkmarks.\n`;

  const earlierFormatted = earlier
    .map(m => `${m.role}: ${m.content.replace(/\n/g, ' ')}`)
    .join('\n');

  const summaryPrompt = `
You are a conversation summarizer for slide edits. ${styleRubric}
Condense the earlier messages into 3 to 5 concise bullet points capturing what was changed or requested. Do not include the last two messages; those will be preserved separately.
${fewShotExample}
Earlier messages:
${earlierFormatted}

Output only the bullet points, each starting with a dash.
`.trim();

  let summaryText = '';
  try {
    const start = Date.now();
    const { text, source } = await generateWithFallback(summaryPrompt, { max_tokens: 250 });
    const duration = Date.now() - start;

    if (!text || !/^[-\u2022]/.test(text.trim())) {
      // malformed summary, skip condensation
      return;
    }

    summaryText = text.trim();
    logAiUsage({ prompt: summaryPrompt, source: source || 'unknown', duration, outputLength: (text || '').length });
  } catch (err) {
    console.warn('[Summary] condensation failed, skipping. Error:', err.message);
    return;
  }

  slide.chatHistory = [
    {
      role: 'system',
      content: `Summary of earlier edits:\n${summaryText}`,
      timestamp: Date.now(),
    },
    ...lastTwo.map(m => ({ ...m })),
  ];
}

function buildEditMessages(slide, userInstruction) {
  const systemMessage = {
    role: 'system',
    content:
      'You are a slide editor. Given existing HTML and an instruction, output only the updated HTML snippet using Tailwind classes. Do not explain.'
  };

  const messages = [systemMessage];
  const summary = slide.chatHistory.find(m => m.role === 'system');
  if (summary) messages.push(summary);
  const lastAssistant = slide.chatHistory.slice().reverse().find(m => m.role === 'assistant');
  if (lastAssistant) messages.push({ role: 'assistant', content: lastAssistant.content });
  messages.push({
    role: 'user',
    content: `Here is the current HTML:\n${slide.currentHtml}\n\nInstruction: ${userInstruction}. Return the full updated HTML slide snippet.`
  });
  return messages;
}

async function applySlideEdit(slide, userInstruction) {
  await condenseChatHistoryIfNeeded(slide);
  const messages = buildEditMessages(slide, userInstruction);
  const sanitizedInput = sanitizeHtmlFragment(slide.currentHtml);
  const cacheKey = makeCacheKey({
    slideMarkdown: sanitizedInput,
    brandingContext: brandContext,
    instruction: userInstruction,
    model: DEFAULT_MODEL,
  });
  const cached = cacheGet(cacheKey);
  if (cached) {
    slide.versionHistory.push({
      html: slide.currentHtml,
      timestamp: Date.now(),
      source: `cache(${cached.metadata.model})`,
      instruction: userInstruction,
    });
    slide.currentHtml = cached.html;
    slide.versionNumber = slide.versionHistory.length;
    slide.chatHistory.push({ role: 'user', content: userInstruction, timestamp: Date.now() });
    slide.chatHistory.push({ role: 'assistant', content: cached.html, timestamp: Date.now() });
    logCacheMetric({ hit: true, type: 'edit' });
    return slide;
  }

  const start = Date.now();
  const { text: updatedHtmlRaw, source } = await editWithFallback(messages);
  const duration = Date.now() - start;
  const sanitized = sanitizeHtmlFragment(updatedHtmlRaw);
  slide.versionHistory.push({
    html: slide.currentHtml,
    timestamp: Date.now(),
    source,
    instruction: userInstruction,
  });
  slide.currentHtml = sanitized;
  slide.versionNumber = slide.versionHistory.length;
  slide.chatHistory.push({ role: 'user', content: userInstruction, timestamp: Date.now() });
  slide.chatHistory.push({ role: 'assistant', content: sanitized, timestamp: Date.now() });
  logAiUsage({ prompt: userInstruction, source, duration, outputLength: (updatedHtmlRaw || '').length });
  logCacheMetric({ hit: false, type: 'edit' });
  const outKey = makeCacheKey({
    slideMarkdown: sanitized,
    brandingContext: brandContext,
    instruction: userInstruction,
    model: DEFAULT_MODEL,
  });
  cacheSet(outKey, sanitized, { model: source, promptHash: hash(userInstruction), branding: brandContext });
  return slide;
}

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
  slide.versionNumber = slide.versionHistory.length;
  return slide;
}

module.exports = { applySlideEdit, revertSlideToVersion, buildEditMessages, condenseChatHistoryIfNeeded };
