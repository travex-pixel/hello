import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBubblePacer, typingDelayMs } from "./pacing";

describe("typingDelayMs", () => {
  it("is brief for short messages, longer for long ones, and bounded", () => {
    const fixed = () => 0.5;
    const short = typingDelayMs("ha", 0, { random: fixed, scale: 1 });
    const long = typingDelayMs("x".repeat(300), 0, { random: fixed, scale: 1 });
    expect(short).toBeGreaterThanOrEqual(600);
    expect(short).toBeLessThan(900);
    expect(long).toBeLessThanOrEqual(2000 * 1.15);
    expect(long).toBeGreaterThan(short);
  });

  it("varies a little, and can be switched off", () => {
    const a = typingDelayMs("hello there", 0, { random: () => 0, scale: 1 });
    const b = typingDelayMs("hello there", 0, { random: () => 1, scale: 1 });
    expect(a).not.toBe(b);
    expect(typingDelayMs("hello", 0, { scale: 0 })).toBe(0);
    expect(typingDelayMs("hello", 0, { scale: 1, reduced: true, random: () => 0.5 })).toBeLessThan(typingDelayMs("hello", 0, { scale: 1, random: () => 0.5 }));
  });
});

describe("createBubblePacer", () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it("counts the pause from when the message was sent, absorbing model latency", async () => {
    const shown: [string, number][] = [];
    const pacer = createBubblePacer({ startedAt: 0, delayFor: () => 1000, show: (t) => shown.push([t, Date.now()]) });
    vi.advanceTimersByTime(700); // model takes 700ms
    pacer.push("hi");
    pacer.end();
    await vi.advanceTimersByTimeAsync(300);
    expect(shown).toEqual([["hi", 1000]]);
  });

  it("shows immediately when the model is slower than the pause", async () => {
    const shown: number[] = [];
    const pacer = createBubblePacer({ startedAt: 0, delayFor: () => 1000, show: () => shown.push(Date.now()) });
    vi.advanceTimersByTime(2500);
    pacer.push("finally");
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toEqual([2500]);
  });

  it("spaces later bubbles from the previous one", async () => {
    const shown: number[] = [];
    const pacer = createBubblePacer({ startedAt: 0, delayFor: (_t, i) => (i === 0 ? 800 : 500), show: () => shown.push(Date.now()) });
    pacer.push("a");
    pacer.push("b");
    pacer.end();
    await vi.advanceTimersByTimeAsync(2000);
    await pacer.done;
    expect(shown).toEqual([800, 1300]);
  });

  it("drops unshown bubbles when cancelled, and resolves", async () => {
    const shown: string[] = [];
    const pacer = createBubblePacer({ startedAt: 0, delayFor: () => 500, show: (t) => shown.push(t) });
    pacer.push("a");
    pacer.push("b");
    await vi.advanceTimersByTimeAsync(600);
    pacer.cancel();
    await vi.advanceTimersByTimeAsync(2000);
    await pacer.done;
    expect(shown).toEqual(["a"]);
    expect(pacer.shown).toBe(1);
  });
});
