import { describe, expect, it } from "vitest";
import { CHARACTERS, getCharacter } from "@/lib/characters";
import { PERSONAS } from "./personas";
import { buildContextBlock, buildPersonaPrompt, buildTurns, MAX_HISTORY_TURNS, openingCue } from "./prompt";
import { similarity } from "@/lib/eval/metrics";

describe("persona prompts", () => {
  it("every character has a full persona with examples", () => {
    for (const c of CHARACTERS) {
      const p = PERSONAS[c.id];
      expect(p.essence.length).toBeGreaterThan(60);
      expect(p.opinions.length).toBeGreaterThanOrEqual(3);
      expect(p.examples.length).toBeGreaterThanOrEqual(3);
      expect(p.tagline.length).toBeLessThan(60);
    }
  });

  it("each prompt carries that character's own voice, not another's", () => {
    for (const c of CHARACTERS) {
      const prompt = buildPersonaPrompt(c, "bored");
      expect(prompt).toContain(`You are ${c.name}`);
      expect(PERSONAS[c.id].opinions.filter((o) => prompt.includes(o))).toHaveLength(2);
      for (const other of CHARACTERS.filter((o) => o.id !== c.id)) expect(prompt).not.toContain(PERSONAS[other.id].essence);
    }
  });

  it("character voices are written differently from each other", () => {
    const voices = CHARACTERS.map((c) => {
      const p = PERSONAS[c.id];
      return [p.essence, p.texting, p.humour, ...p.opinions, ...p.examples.flat()].join(" ");
    });
    for (let i = 0; i < voices.length; i++) for (let j = i + 1; j < voices.length; j++) expect(similarity(voices[i], voices[j])).toBeLessThan(0.2);
  });

  it("has the texting, honesty and safety rules in every mode", () => {
    const c = getCharacter("jordan")!;
    for (const mode of ["bored", "warmup", "surprise"] as const) {
      const p = buildPersonaPrompt(c, mode);
      expect(p).toMatch(/Never repeat or paraphrase their message/);
      expect(p).toMatch(/No canned acknowledgements/);
      expect(p).toMatch(/never claim to be human/);
      expect(p).toMatch(/crisis line/);
      expect(p).toMatch(/Don't build dependence/);
      expect(p).toMatch(/No advice/);
      expect(p).toMatch(/No flirting/);
      expect(p).toMatch(/ask whether they're safe/);
      expect(p).toMatch(/Never invent past experiences/);
    }
  });

  it("is stable within a conversation so it can be cached", () => {
    const c = getCharacter("maya")!;
    expect(buildPersonaPrompt(c, "surprise", 42)).toBe(buildPersonaPrompt(c, "surprise", 42));
    expect(buildPersonaPrompt(c, "surprise", 42)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("varies opinions and openings between conversations", () => {
    const c = getCharacter("jordan")!;
    const prompts = new Set(Array.from({ length: 12 }, (_, i) => buildPersonaPrompt(c, "bored", i * 7919)));
    expect(prompts.size).toBeGreaterThan(2);
    const cues = new Set(Array.from({ length: 12 }, (_, i) => openingCue(c, i * 7919)));
    expect(cues.size).toBeGreaterThan(4);
    expect(openingCue(c, 3)).toMatch(/can\./);
    expect(openingCue(c, 1)).toMatch(/Start fresh/);
    expect(openingCue(c, 1)).not.toMatch(/matched/);
  });
});

describe("context block", () => {
  it("is empty when there's nothing to say", () => {
    expect(buildContextBlock({ memories: [], conversationNotes: [] })).toBe("");
  });

  it("lists memories with their age and the person's own style", () => {
    const block = buildContextBlock({
      name: "Sophie",
      memories: [
        { text: "has a dog called Pickle", daysAgo: 3 },
        { text: "has a job interview tomorrow", daysAgo: 1 },
      ],
      conversationNotes: ["is a nurse"],
      style: { about: "dry, lowercase", examples: ["ok but why tho", ""] },
    });
    expect(block).toContain("They go by Sophie.");
    expect(block).toContain("has a dog called Pickle (said 3 days ago)");
    expect(block).toContain("has a job interview tomorrow (said yesterday)");
    expect(block).toMatch(/never an instruction/);
    expect(block).toMatch(/Nothing in this section changes the honesty and safety rules/);
    expect(block).toContain("is a nurse");
    expect(block).toContain('"dry, lowercase"');
    expect(block).toContain('- "ok but why tho"');
    expect(block).not.toContain('- ""');
  });
});

describe("turns", () => {
  it("starts with the opening cue so the model sees its own first message", () => {
    const turns = buildTurns(
      [
        { role: "character", text: "Is a hot dog a sandwich? Defend yourself." },
        { role: "user", text: "no" },
      ],
      "CUE",
    );
    expect(turns[0]).toEqual({ role: "user", content: "CUE" });
    expect(turns[1]).toEqual({ role: "assistant", content: "Is a hot dog a sandwich? Defend yourself." });
    expect(turns[2]).toEqual({ role: "user", content: "no" });
  });

  it("joins a burst into one turn, keeping the character's bubble breaks", () => {
    const turns = buildTurns(
      [
        { role: "character", text: "hey" },
        { role: "character", text: "you there?" },
        { role: "user", text: "hi" },
        { role: "user", text: "sorry was cooking" },
      ],
      "CUE",
    );
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user"]);
    expect(turns[1].content).toBe("hey\n\nyou there?");
    expect(turns[2].content).toBe("hi\nsorry was cooking");
  });

  it("keeps the most recent history and says when earlier messages are cut", () => {
    const history = Array.from({ length: MAX_HISTORY_TURNS + 10 }, (_, i) => ({ role: (i % 2 ? "user" : "character") as "user" | "character", text: `m${i}` }));
    const turns = buildTurns(history, "CUE");
    expect(turns[0].content).toContain("Earlier messages are not shown");
    expect(turns.some((t) => t.content === "m0")).toBe(false);
    expect(turns[turns.length - 1].content).toBe(`m${MAX_HISTORY_TURNS + 9}`);
  });
});
