import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/utils/rng";
import { DEFAULT_PREFERENCES, findMatch, rankCandidates } from "./index";

describe("matching", () => {
  it("never returns the character the user just left when others exist", () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = findMatch({ mode: "bored", preferences: DEFAULT_PREFERENCES, recentCharacterIds: ["jordan"], blockedCharacterIds: [], rng: mulberry32(seed) });
      expect(m?.character.id).not.toBe("jordan");
    }
  });

  it("excludes blocked characters entirely", () => {
    const ranked = rankCandidates({ mode: "surprise", preferences: DEFAULT_PREFERENCES, recentCharacterIds: [], blockedCharacterIds: ["riley", "alex"], rng: mulberry32(1) });
    expect(ranked.map((r) => r.character.id)).not.toContain("riley");
    expect(ranked.map((r) => r.character.id)).not.toContain("alex");
  });

  it("explains shared interests honestly", () => {
    const ranked = rankCandidates({ mode: "bored", preferences: { ...DEFAULT_PREFERENCES, topics: ["sport", "music"] }, recentCharacterIds: [], blockedCharacterIds: [], rng: mulberry32(1) });
    const alex = ranked.find((r) => r.character.id === "alex")!;
    expect(alex.reasons[0]).toMatch(/You both like/);
    const morgan = ranked.find((r) => r.character.id === "morgan")!;
    expect(morgan.reasons.join(" ")).not.toMatch(/You both like/);
  });

  it("prefers gentle characters for warm-up and novel ones for surprise", () => {
    const warm = Array.from({ length: 40 }, (_, i) => findMatch({ mode: "warmup", preferences: DEFAULT_PREFERENCES, recentCharacterIds: [], blockedCharacterIds: [], rng: mulberry32(i) })!.character.id);
    expect(warm.filter((id) => id === "morgan").length).toBeLessThan(3);
    const surprise = Array.from({ length: 40 }, (_, i) => findMatch({ mode: "surprise", preferences: { ...DEFAULT_PREFERENCES, topics: ["comedy", "tv", "food", "gaming", "sport"] }, recentCharacterIds: [], blockedCharacterIds: [], rng: mulberry32(i) })!.character.id);
    expect(surprise.filter((id) => id === "jordan").length).toBeLessThan(3);
  });

  it("varies who it picks across sessions", () => {
    const ids = new Set(Array.from({ length: 40 }, (_, i) => findMatch({ mode: "bored", preferences: DEFAULT_PREFERENCES, recentCharacterIds: [], blockedCharacterIds: [], rng: mulberry32(i) })!.character.id));
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it("returns nothing when every candidate is excluded", () => {
    const m = findMatch({ mode: "bored", preferences: { ...DEFAULT_PREFERENCES, language: "fr" }, recentCharacterIds: [], blockedCharacterIds: [], rng: mulberry32(1) });
    expect(m).toBeUndefined();
  });
});
