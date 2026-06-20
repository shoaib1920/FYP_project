/**
 * Minimal in-memory sliding-window rate limiter, keyed by an arbitrary string (e.g. userId).
 * Not for general API protection (that's a separate broader task) — this exists specifically
 * to stop one user from burning through a shared, quota-limited external API key.
 */
function createRateLimiter({ maxRequests, windowMs }) {
  const hits = new Map(); // key -> array of timestamps

  return function isAllowed(key) {
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      hits.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    return true;
  };
}

module.exports = { createRateLimiter };
