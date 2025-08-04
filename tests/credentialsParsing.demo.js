const assert = require('assert');

function parseGoogleCredentials(raw) {
  const cleaned = raw.trim().replace(/^\uFEFF/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    try {
      const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
      const sanitized = decoded.trim().replace(/^\uFEFF/, '');
      return JSON.parse(sanitized);
    } catch (err) {
      console.error('Failed to parse GOOGLE_CREDENTIALS JSON:', err.message);
      throw new Error('Invalid GOOGLE_CREDENTIALS environment variable. Ensure it is valid JSON or base64-encoded JSON.');
    }
  }
}

const sample = JSON.stringify({ project_id: 'demo-project', private_key: 'dummy' });
const base64 = Buffer.from(sample, 'utf8').toString('base64');

assert.deepStrictEqual(parseGoogleCredentials(sample), JSON.parse(sample));
assert.deepStrictEqual(parseGoogleCredentials(base64), JSON.parse(sample));

console.log('Credential parsing succeeded for both plain JSON and base64 inputs.');
