function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => {
      acc[k] = sortValue(v[k]);
      return acc;
    }, {});
  }
  return v;
}

function stableStringify(obj) {
  return JSON.stringify(sortValue(obj));
}

module.exports = stableStringify;
