const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadFresh() {
  delete require.cache[require.resolve('../config/brandContext')];
  return require('../config/brandContext');
}

// Basic load test
const { brandContext } = loadFresh();
assert.strictEqual(brandContext.brandName, 'eComplete Commerce');
assert.ok(Array.isArray(brandContext.stakeholders));
assert.strictEqual(brandContext.stakeholders.length, 5);
console.log('brandContext loaded correctly');

// Missing key test
const tmp = path.join(__dirname, 'tmp.json');
fs.writeFileSync(tmp, '{}');
process.env.BRANDCONFIG_PATH = tmp;
try {
  assert.throws(() => loadFresh(), /Missing required key/);
  console.log('missing key error thrown as expected');
} finally {
  delete process.env.BRANDCONFIG_PATH;
  fs.unlinkSync(tmp);
}
