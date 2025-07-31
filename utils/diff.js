function diffHtml(oldHtml, newHtml) {
  const oldParts = oldHtml.split(/(\s+)/).filter(Boolean);
  const newParts = newHtml.split(/(\s+)/).filter(Boolean);
  const diff = [];
  let i = 0,
    j = 0;
  while (i < oldParts.length && j < newParts.length) {
    if (oldParts[i] === newParts[j]) {
      diff.push({ value: newParts[j] });
      i++;
      j++;
    } else {
      diff.push({ value: newParts[j], added: true });
      diff.push({ value: oldParts[i], removed: true });
      i++;
      j++;
    }
  }
  while (j < newParts.length) {
    diff.push({ value: newParts[j], added: true });
    j++;
  }
  while (i < oldParts.length) {
    diff.push({ value: oldParts[i], removed: true });
    i++;
  }
  return diff;
}
module.exports = { diffHtml };
