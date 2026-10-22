/**
 * In-memory sliding-window limiter. Good enough for a single server process
 * and for local testing; a multi-instance deployment needs a shared store
 * (for example Redis or a database table). See docs/HUMAN_MODE.md.
 */
export interface RateLimiter {
  /** Returns true if the action is allowed and records it. */
  allow(key: string, now?: number): boolean;
  retryAfterMs(key: string, now?: number): number;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;
  const prune = (key: string, now: number) => {
    // Occasionally drop keys with no recent hits, so many distinct keys can't grow memory forever.
    if (now - lastSweep > windowMs) {
      lastSweep = now;
      for (const [k, times] of hits) if (!times.some((t) => now - t < windowMs)) hits.delete(k);
    }
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    allow(key, now = Date.now()) {
      const list = prune(key, now);
      if (list.length >= limit) return false;
      list.push(now);
      hits.set(key, list);
      return true;
    },
    retryAfterMs(key, now = Date.now()) {
      const list = prune(key, now);
      if (list.length < limit) return 0;
      return Math.max(0, windowMs - (now - list[0]));
    },
  };
}
