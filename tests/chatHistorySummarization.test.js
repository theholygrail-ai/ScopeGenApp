const assert = require('assert');

// Stub the AI provider to return a predictable summary
const mockSummary = `- Made header larger.
- Changed bullets to checkmarks.
- Added teal accent to titles.`;

const aiMock = {
  generateWithFallback: async (prompt, opts) => {
    return { source: 'mock', text: mockSummary };
  },
};
require.cache[require.resolve('../services/aiProvider')] = { exports: aiMock };

const { condenseChatHistoryIfNeeded } = require('../services/slideEditor');

(async () => {
  // Build fake slide with long history: alternating user and assistant
  const slide = {
    currentHtml: '<div>initial</div>',
    versionHistory: [],
    chatHistory: [],
    versionNumber: 1,
  };

  // Seed 10 earlier messages (more than threshold of 8)
  for (let i = 0; i < 5; i++) {
    slide.chatHistory.push({ role: 'user', content: `user instruction ${i}`, timestamp: Date.now() - 10000 });
    slide.chatHistory.push({ role: 'assistant', content: `assistant response ${i}`, timestamp: Date.now() - 9000 });
  }

  // Recent two messages should be kept after condensation
  slide.chatHistory.push({ role: 'user', content: 'latest instruction', timestamp: Date.now() - 1000 });
  slide.chatHistory.push({ role: 'assistant', content: 'latest assistant reply', timestamp: Date.now() - 500 });

  // Precondition: length > threshold
  assert(slide.chatHistory.length > 8);

  await condenseChatHistoryIfNeeded(slide);

  // After condensation, expect:
  // - chatHistory length should be exactly 3 (1 system summary + last two)
  assert.strictEqual(slide.chatHistory.length, 3);

  const system = slide.chatHistory[0];
  const lastUser = slide.chatHistory[1];
  const lastAssistant = slide.chatHistory[2];

  assert.strictEqual(system.role, 'system');
  assert(system.content.includes('Made header larger')); // summary content present
  assert.strictEqual(lastUser.role, 'user');
  assert.strictEqual(lastUser.content, 'latest instruction');
  assert.strictEqual(lastAssistant.role, 'assistant');
  assert.strictEqual(lastAssistant.content, 'latest assistant reply');

  console.log('✅ chatHistory summarization works and preserves latest two turns');
})();
