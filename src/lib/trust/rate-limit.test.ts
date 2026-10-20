import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit inside the window and blocks after", () => {
    const rl = createRateLimiter(3, 1000);
    expect(rl.allow("k", 0)).toBe(true);
    expect(rl.allow("k", 10)).toBe(true);
    expect(rl.allow("k", 20)).toBe(true);
    expect(rl.allow("k", 30)).toBe(false);
    expect(rl.retryAfterMs("k", 30)).toBe(970);
    expect(rl.allow("k", 1001)).toBe(true);
  });

  it("keeps keys independent", () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("b", 0)).toBe(true);
    expect(rl.allow("a", 1)).toBe(false);
  });
});
