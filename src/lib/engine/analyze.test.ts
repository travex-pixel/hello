import { describe, expect, it } from "vitest";
import { analyzeMessage } from "./analyze";

describe("analyzeMessage", () => {
  it("detects greetings and farewells", () => {
    expect(analyzeMessage("hey").intents).toContain("greeting");
    expect(analyzeMessage("ok gotta go, bye!").intents).toContain("farewell");
  });

  it("extracts what the user likes and maps it to a topic", () => {
    const a = analyzeMessage("I love basketball and I also play guitar");
    expect(a.intents).toContain("like");
    expect(a.likeObject).toBe("basketball");
    expect(a.topics).toContain("sport");
    expect(a.topics).toContain("music");
  });

  it("extracts dislikes", () => {
    const a = analyzeMessage("honestly I can't stand horror films");
    expect(a.intents).toContain("dislike");
    expect(a.dislikeObject).toBe("horror films");
  });

  it("recognises questions about being an AI", () => {
    expect(analyzeMessage("wait are you a real person?").intents).toContain("ai_question");
    expect(analyzeMessage("Are you an AI").intents).toContain("ai_question");
  });

  it("captures a name without mistaking adjectives for names", () => {
    expect(analyzeMessage("Hi, I'm Priya").userName).toBe("Priya");
    expect(analyzeMessage("I'm Bored").userName).toBeUndefined();
    expect(analyzeMessage("I'm from Melbourne actually").placeName).toBe("Melbourne");
    expect(analyzeMessage("I live in New York").placeName).toBe("New York");
    expect(analyzeMessage("i'm tired today").userName).toBeUndefined();
  });

  it("flags low-effort replies", () => {
    expect(analyzeMessage("ok").intents).toContain("low_effort");
    expect(analyzeMessage("idk").intents).toContain("low_effort");
    expect(analyzeMessage("I had a pretty long day at work actually").intents).not.toContain("low_effort");
  });

  it("flags awkwardness and boredom without judging", () => {
    expect(analyzeMessage("sorry I'm bad at small talk").intents).toContain("awkward");
    expect(analyzeMessage("i'm so bored").intents).toContain("bored");
  });

  it("does not treat a passing thanks as a thank-you message", () => {
    expect(analyzeMessage("thanks!").intents).toContain("thanks");
    expect(analyzeMessage("I'm good thanks, bit tired").intents).not.toContain("thanks");
    expect(analyzeMessage("I'm good thanks, bit tired").intents).toContain("tired");
  });

  it("flags requests for personal contact details as boundary", () => {
    expect(analyzeMessage("what's your instagram?").intents).toContain("boundary");
  });

  it("flags sensitive content", () => {
    expect(analyzeMessage("sometimes i want to die").intents).toContain("sensitive");
  });
});
