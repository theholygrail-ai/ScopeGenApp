const assert = require('assert');

function parseGoogleCredentials(raw) {
  const cleaned = raw.trim().replace(/^\uFEFF/, '');
  try {
    const unwrapped =
      cleaned.startsWith('"') && cleaned.endsWith('"')
        ? cleaned.slice(1, -1)
        : cleaned;
    const jsonString = unwrapped.trim().startsWith('{') ? unwrapped : `{${unwrapped}}`;
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('Failed to parse GOOGLE_CREDENTIALS string:', err.message);
    throw new Error('Invalid GOOGLE_CREDENTIALS environment variable. Ensure it is a valid JSON string.');
  }
}

const sampleObj = { project_id: 'demo-project', private_key: 'dummy' };
const sample = JSON.stringify(sampleObj);
const inner = sample.slice(1, -1); // remove surrounding braces
const wrapped = `"${inner}"`;

assert.deepStrictEqual(parseGoogleCredentials(sample), sampleObj);
assert.deepStrictEqual(parseGoogleCredentials(wrapped), sampleObj);

console.log('Credential parsing succeeded for both plain JSON and quoted inner object strings.');
