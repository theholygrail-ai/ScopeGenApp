const slideQueues = new Map();

/**
 * Serializes operations on a particular slideId.
 * @param {string} slideId
 * @param {() => Promise<any>} task
 * @returns {Promise<any>}
 */
function withSlideLock(slideId, task) {
  const prev = slideQueues.get(slideId) || Promise.resolve();
  // swallow errors from previous so the chain continues
  const next = prev.catch(() => {}).then(() => task());
  slideQueues.set(slideId, next);
  next.finally(() => {
    if (slideQueues.get(slideId) === next) {
      slideQueues.delete(slideId);
    }
  });
  return next;
}

module.exports = { withSlideLock };
