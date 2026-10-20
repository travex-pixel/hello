import { describe, expect, it } from "vitest";
import { CHARACTERS, getCharacter } from "@/lib/characters";
import type { Mode } from "@/lib/characters/types";
import { mulberry32 } from "@/lib/utils/rng";
import { generateOpening, generateReply, isPrompt } from "./compose";
import { createMemory, type Memory } from "./memory";

const MODES: Mode[] = ["bored", "warmup", "surprise"];

function run(characterId: string, mode: Mode, script: string[], seed = 7) {
  const character = getCharacter(characterId)!;
  const rng = mulberry32(seed);
  let memory: Memory = createMemory();
  const opening = generateOpening({ character, mode, memory, rng });
  memory = opening.memory;
  const replies: string[] = [opening.messages.join(" ")];
  for (const line of script) {
    const out = generateReply({ character, mode, memory, userMessage: line, rng });
    memory = out.memory;
    replies.push(out.messages.join(" "));
  }
  return { replies, memory };
}

const SCRIPT = [
  "hey",
  "I'm good thanks, bit tired",
  "I love basketball, play most weekends",
  "what do you think about music?",
  "haha nice",
  "ok",
  "are you a real person?",
  "idk",
  "I'm from Melbourne actually",
  "tell me a joke",
  "what else do you like",
  "fair enough",
];

describe("local engine", () => {
  it("gives every character a different opening in every mode", () => {
    for (const mode of MODES) {
      const openings = CHARACTERS.map((c) => generateOpening({ character: c, mode, memory: createMemory(), rng: mulberry32(1) }).messages[0]);
      expect(new Set(openings).size).toBe(CHARACTERS.length);
    }
    for (const c of CHARACTERS) {
      const perMode = MODES.map((mode) => generateOpening({ character: c, mode, memory: createMemory(), rng: mulberry32(1) }).messages[0]);
      expect(new Set(perMode).size).toBe(3);
    }
  });

  it("is honest about being an AI when asked", () => {
    for (const c of CHARACTERS) {
      const out = generateReply({ character: c, mode: "bored", memory: createMemory(), userMessage: "are you a real person?", rng: mulberry32(3) });
      expect(out.messages.join(" ")).toMatch(/\bAI\b/);
    }
  });

  it("remembers what the user likes and brings it back later", () => {
    const character = getCharacter("alex")!;
    const rng = mulberry32(11);
    let memory = createMemory();
    memory = generateOpening({ character, mode: "bored", memory, rng }).memory;
    memory = generateReply({ character, mode: "bored", memory, userMessage: "I love basketball", rng }).memory;
    expect(memory.likes.map((l) => l.text)).toContain("basketball");
    expect(memory.topics.sport).toBeDefined();
    // Several neutral turns later, the character should be able to call it back.
    let mentioned = false;
    const filler = ["yeah", "that's fair", "hmm maybe", "not much really", "true", "yeah I guess so", "ok", "sure"];
    for (const line of filler) {
      const out = generateReply({ character, mode: "bored", memory, userMessage: line, rng });
      memory = out.memory;
      if (/basketball/i.test(out.messages.join(" "))) mentioned = true;
    }
    expect(mentioned || memory.likes[0].calledBack).toBe(true);
  });

  it("does not repeat itself over a 12-turn conversation", () => {
    for (const c of CHARACTERS) {
      for (const mode of MODES) {
        const { replies } = run(c.id, mode, SCRIPT);
        const seen = new Set<string>();
        for (const r of replies) {
          expect(seen.has(r)).toBe(false);
          seen.add(r);
        }
      }
    }
  });

  it("never asks the same question twice in a long conversation", () => {
    const extra = [
      "I also like cooking, mostly pasta",
      "what about films, any favourites?",
      "nah not really",
      "I work as a nurse",
      "do you like travelling?",
      "yeah",
      "I hate mondays honestly",
      "lol",
      "what's your name again",
      "true",
      "I play guitar a bit",
      "hmm",
    ];
    const longScript = [...SCRIPT, ...extra, ...SCRIPT.map((l, i) => (i % 2 === 0 ? "yeah" : l))];
    for (const c of CHARACTERS) {
      for (const mode of MODES) {
        const { replies } = run(c.id, mode, longScript, 3);
        const seen = new Set<string>();
        for (const r of replies) {
          for (const sentence of r.split(/(?<=[.!?])\s+/)) {
            // Only real questions count; "Right?" or "You?" are reactions.
            if (!sentence.includes("?") || sentence.split(" ").length < 4) continue;
            expect(seen.has(sentence), `${c.id}/${mode} repeated: ${sentence}`).toBe(false);
            seen.add(sentence);
          }
        }
      }
    }
  });

  it("does not end every reply with a question", () => {
    const { replies } = run("sam", "bored", [...SCRIPT, ...SCRIPT]);
    const questionEndings = replies.filter((r) => /\?\s*$/.test(r)).length;
    expect(questionEndings).toBeLessThan(replies.length);
  });

  it("produces meaningfully different replies across characters for the same script", () => {
    const all = CHARACTERS.map((c) => run(c.id, "surprise", SCRIPT, 5).replies);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const same = all[i].filter((r, k) => r === all[j][k]).length;
        // Allow the sensitive/AI-shared lines to coincide, nothing else.
        expect(same).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps Sam calm: no exclamation marks", () => {
    const { replies } = run("sam", "bored", SCRIPT);
    for (const r of replies) expect(r).not.toContain("!");
  });

  it("keeps Casey brief early and lets them open up later", () => {
    const { replies } = run("casey", "warmup", SCRIPT);
    const early = replies.slice(1, 4).map((r) => r.split(/(?<=[.!?])\s+/).length);
    expect(Math.max(...early)).toBeLessThanOrEqual(4);
  });

  it("reads a short reply as an answer to its own question and moves on", () => {
    const character = getCharacter("alex")!;
    const rng = mulberry32(2);
    let memory = createMemory();
    memory = generateOpening({ character, mode: "warmup", memory, rng }).memory;
    const out = generateReply({ character, mode: "warmup", memory, userMessage: "night person", rng });
    expect(out.messages.join(" ").length).toBeGreaterThan(10);
    expect(out.memory.lastMove?.askedQuestion).toBe(true);
  });

  it("responds to sensitive messages with support, not banter", () => {
    const out = generateReply({ character: getCharacter("jordan")!, mode: "bored", memory: createMemory(), userMessage: "i want to die", rng: mulberry32(1) });
    expect(out.messages.join(" ")).toMatch(/crisis line|emergency/);
  });

  it("handles farewells and closes the conversation", () => {
    const out = generateReply({ character: getCharacter("maya")!, mode: "bored", memory: createMemory(), userMessage: "ok gotta go, bye", rng: mulberry32(1) });
    expect(out.move).toBe("farewell");
  });

  it("warm-up mode asks easy questions early", () => {
    for (const c of CHARACTERS) {
      const out = generateReply({ character: c, mode: "warmup", memory: generateOpening({ character: c, mode: "warmup", memory: createMemory(), rng: mulberry32(4) }).memory, userMessage: "hi", rng: mulberry32(4) });
      expect(out.messages.join(" ")).toMatch(/\?/);
    }
  });
});

describe("isPrompt", () => {
  it("recognises questions and closing imperatives", () => {
    expect(isPrompt("What's your name?")).toBe(true);
    expect(isPrompt("I know nothing about music, so this is your moment. Enlighten me.")).toBe(true);
    expect(isPrompt("Rapid fire: best film snack, worst film snack, go.")).toBe(true);
    expect(isPrompt("I think attention is the rarest thing anyone can give.")).toBe(false);
    expect(isPrompt("Ha. That's good.")).toBe(false);
  });
});

describe("transcript dump (set TRANSCRIPT=1 to print)", () => {
  it.runIf(process.env.TRANSCRIPT === "1")("writes sample conversations to TRANSCRIPT_OUT", async () => {
    const fs = await import("node:fs");
    const ids = (process.env.TRANSCRIPT_IDS ?? CHARACTERS.map((c) => c.id).join(",")).split(",");
    const modes = (process.env.TRANSCRIPT_MODES ?? MODES.join(",")).split(",") as Mode[];
    const lines: string[] = [];
    for (const id of ids) {
      for (const mode of modes) {
        const { replies } = run(id, mode, SCRIPT, 9);
        lines.push(`\n===== ${id.toUpperCase()} / ${mode} =====`);
        replies.forEach((r, i) => {
          if (i > 0) lines.push(`  YOU: ${SCRIPT[i - 1]}`);
          lines.push(`  ${id}: ${r}`);
        });
      }
    }
    fs.writeFileSync(process.env.TRANSCRIPT_OUT ?? "transcript.txt", lines.join("\n"));
  });
});
