const { editWithFallback, generateWithFallback } = require('./aiProvider');
const { sanitizeHtmlFragment } = require('./slideGenerator');
const { logAiUsage, logCacheMetric, hash } = require('../utils/logging');
const { makeCacheKey, get: cacheGet, set: cacheSet } = require('./slideCache');
const { brandContext } = require('../config/brandContext');

function shouldCondense(history) {
  return Array.isArray(history) && history.length > 8;
}

async function condenseChatHistoryIfNeeded(slide) {
  if (!shouldCondense(slide.chatHistory)) return;
  const earlier = slide.chatHistory.slice(0, -2);
  const summaryPrompt =
    'You are an assistant that summarizes a conversation about editing an HTML slide. ' +
    'Condense the following earlier messages into concise bullet points capturing what was changed or requested.\n' +
    earlier.map(m => `${m.role}: ${m.content}`).join('\n') +
    '\nProvide a summary in 3-5 bullets. Output only the bullets.';
  const { text } = await generateWithFallback(summaryPrompt, { max_tokens: 200 });
  slide.chatHistory = [
    { role: 'system', content: `Summary of earlier edits: ${text}`, timestamp: Date.now() },
    ...slide.chatHistory.slice(-2),
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
  const cacheKey = makeCacheKey({ slideMarkdown: slide.currentHtml, brandingContext: brandContext, instruction: userInstruction, model: 'fallback' });
  const cached = cacheGet(cacheKey);
  if (cached) {
    slide.versionHistory.push({
      html: slide.currentHtml,
      timestamp: Date.now(),
      source: 'cache',
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
  cacheSet(cacheKey, sanitized, { model: source, promptHash: hash(userInstruction), branding: brandContext });
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
