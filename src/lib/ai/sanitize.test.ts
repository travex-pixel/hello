import { describe, expect, it } from "vitest";
import { cleanBubble, createBubbleSplitter, toBubbles } from "./sanitize";

describe("cleanBubble", () => {
  it("strips markdown, list markers and name prefixes", () => {
    expect(cleanBubble("**Honestly** that's *wild*", "Jordan")).toBe("Honestly that's wild");
    expect(cleanBubble("Jordan: lol fair", "Jordan")).toBe("lol fair");
    expect(cleanBubble("- first\n- second")).toBe("first second");
    expect(cleanBubble("## Title")).toBe("Title");
  });

  it("removes canned openers but keeps the rest", () => {
    expect(cleanBubble("Great question! I'd pick the sea.")).toBe("I'd pick the sea.");
    expect(cleanBubble("That's so interesting. What got you into it?")).toBe("What got you into it?");
    expect(cleanBubble("I completely understand, that sounds rough")).toBe("That sounds rough");
  });

  it("keeps lowercase texters lowercase and drops roleplay actions", () => {
    expect(cleanBubble("that's so interesting. what made you pick it")).toBe("what made you pick it");
    expect(cleanBubble("*laughs* okay fair")).toBe("okay fair");
    expect(cleanBubble("okay fair *grins*")).toBe("okay fair");
  });

  it("leaves ordinary messages alone", () => {
    expect(cleanBubble("wait that's so cool")).toBe("wait that's so cool");
    expect(cleanBubble("Fair.")).toBe("Fair.");
  });

  it("drops self-quoting and caps runaway length", () => {
    expect(cleanBubble('"hello there"')).toBe("hello there");
    expect(cleanBubble("word ".repeat(400)).length).toBeLessThanOrEqual(601);
  });
});

describe("bubbles", () => {
  it("splits on blank lines, never more than three", () => {
    expect(toBubbles("one\n\ntwo")).toEqual(["one", "two"]);
    expect(toBubbles("a\n\nb\n\nc\n\nd")).toEqual(["a", "b", "c d"]);
    expect(toBubbles("   \n\n  ")).toEqual([]);
  });

  it("emits streamed bubbles as soon as a blank line closes them", () => {
    const s = createBubbleSplitter("Riley");
    expect(s.push("wait")).toEqual([]);
    expect(s.push(" really?\n")).toEqual([]);
    expect(s.push("\nthat's amazing")).toEqual(["wait really?"]);
    expect(s.flush()).toEqual(["that's amazing"]);
  });

  it("joins anything past the third bubble", () => {
    const s = createBubbleSplitter();
    const out = [...s.push("a\n\nb\n\nc\n\nd\n\ne"), ...s.flush()];
    expect(out).toEqual(["a", "b", "c d e"]);
  });
});
