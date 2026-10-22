import { getCharacter } from "@/lib/characters";
import type { CharacterId, Mode } from "@/lib/characters/types";
import { generateOpening, generateReply } from "@/lib/engine/compose";
import { createMemory, type Memory } from "@/lib/engine/memory";
import { mulberry32 } from "@/lib/utils/rng";

/** Anything that can hold one side of a scripted conversation. */
export interface EvalEngine {
  name: string;
  start(characterId: CharacterId, mode: Mode, durable: string[]): Promise<EvalSession>;
}

export interface EvalSession {
  opening: string[];
  reply(userMessage: string): Promise<{ replies: string[]; ms: number; firstMs?: number; usage?: { input: number; output: number; cacheRead: number } }>;
  /** Facts this session would keep for future sessions (empty if the engine has no durable memory). */
  durableAfter(): string[];
}

/** The current rule-based engine, exactly as the browser runs it. */
export function localEngine(seed = 7): EvalEngine {
  return {
    name: "local",
    async start(characterId, mode) {
      const character = getCharacter(characterId)!;
      const rng = mulberry32(seed);
      let memory: Memory = createMemory();
      const open = generateOpening({ character, mode, memory, rng });
      memory = open.memory;
      return {
        opening: open.messages,
        async reply(userMessage) {
          const t = performance.now();
          const out = generateReply({ character, mode, memory, userMessage, rng });
          memory = out.memory;
          return { replies: out.messages, ms: performance.now() - t };
        },
        durableAfter: () => [],
      };
    },
  };
}
