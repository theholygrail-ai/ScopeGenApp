const crypto = require('crypto');

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function logAiUsage({ prompt, source, duration, outputLength }) {
  console.info(`[AI] PromptHash=${hash(prompt)} Source=${source} DurationMs=${duration} OutputLength=${outputLength}`);
}

module.exports = { hash, logAiUsage };
