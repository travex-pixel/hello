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
  const prune = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, list);
    return list;
  };
  return {
    allow(key, now = Date.now()) {
      const list = prune(key, now);
      if (list.length >= limit) return false;
      list.push(now);
      return true;
    },
    retryAfterMs(key, now = Date.now()) {
      const list = prune(key, now);
      if (list.length < limit) return 0;
      return Math.max(0, windowMs - (now - list[0]));
    },
  };
}
