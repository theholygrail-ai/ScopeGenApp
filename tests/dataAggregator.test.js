const assert = require('assert');
const {
  mapTicker,
  isCryptoTicker
} = require('../utils/dataAggregator');

// mapTicker crypto cases
const xrp = mapTicker('XRP');
assert.deepStrictEqual(xrp, { type: 'crypto', coingeckoId: 'ripple', symbol: 'XRP' });

const doge = mapTicker('doge');
assert.deepStrictEqual(doge, { type: 'crypto', coingeckoId: 'dogecoin', symbol: 'DOGE' });

// mapTicker non-crypto
const nas = mapTicker('NAS100');
assert.deepStrictEqual(nas, { type: 'traditional', polygonSymbol: 'NAS100' });

// isCryptoTicker
assert.strictEqual(isCryptoTicker('XRP'), true);
assert.strictEqual(isCryptoTicker('NAS100'), false);

console.log('✅ dataAggregator crypto mapping works');
