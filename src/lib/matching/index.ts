import { CHARACTERS } from "@/lib/characters";
import type { Character, Mode } from "@/lib/characters/types";
import { TOPIC_LABELS, type TopicId } from "@/lib/characters/topics";
import type { Rng } from "@/lib/utils/rng";

export type DepthPreference = "quick" | "deeper" | "either";
export type VibePreference = "funny" | "thoughtful" | "outgoing" | "any";

export interface TextingStyle {
  /** "Make it more like me": how they describe their own texting. */
  about?: string;
  /** Up to three messages they'd actually send. */
  examples?: string[];
}

export interface Preferences {
  displayName?: string;
  style?: TextingStyle;
  topics: TopicId[];
  depth: DepthPreference;
  vibe: VibePreference;
  language: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  topics: [],
  depth: "either",
  vibe: "any",
  language: "en",
};

export interface MatchContext {
  mode: Mode;
  preferences: Preferences;
  /** Most recent first. */
  recentCharacterIds: string[];
  blockedCharacterIds: string[];
  rng: Rng;
  candidates?: Character[];
}

export interface MatchResult {
  character: Character;
  score: number;
  /** Short, honest reasons shown on the card. Never more than two. */
  reasons: string[];
}

export const MODE_COPY: Record<Mode, { label: string; blurb: string; finding: string }> = {
  bored: { label: "I'm bored", blurb: "Someone fun to talk to, right now.", finding: "Finding someone fun" },
  warmup: { label: "Warm me up", blurb: "An easy, low-pressure chat.", finding: "Finding someone easy to talk to" },
  surprise: { label: "Surprise me", blurb: "Someone unexpected.", finding: "Finding someone unexpected" },
};

function overlap(a: TopicId[], b: TopicId[]): TopicId[] {
  return a.filter((t) => b.includes(t));
}

/**
 * Explainable scoring. Every term that moves the score can be read back as a
 * reason, and the result is deliberately noisy so the same mode does not
 * always surface the same character.
 */
export function rankCandidates(ctx: MatchContext): MatchResult[] {
  const pool = (ctx.candidates ?? CHARACTERS).filter(
    (c) => c.languages.includes(ctx.preferences.language) && !ctx.blockedCharacterIds.includes(c.id),
  );
  const results: MatchResult[] = [];

  for (const c of pool) {
    let score = 0;
    const reasons: string[] = [];
    const shared = overlap(ctx.preferences.topics, c.interests);

    if (ctx.mode === "bored") {
      score += c.energy * 0.5 + c.humour * 0.4;
      if (c.energy >= 4 && c.humour >= 3) reasons.push("Fun and quick on their feet");
      else if (c.humour >= 4) reasons.push("Will probably make you laugh");
    } else if (ctx.mode === "warmup") {
      score += c.warmth * 0.9 - Math.max(0, c.depth - 3) * 0.3;
      if (c.warmth >= 5) reasons.push("Easy to talk to, carries the conversation");
      else if (c.warmth >= 4) reasons.push("Takes things at your pace");
    } else {
      // surprise: reward distance from what the user already likes
      const novelty = ctx.preferences.topics.length > 0 ? c.interests.length - shared.length : c.interests.length * 0.5;
      score += novelty * 0.5 + c.depth * 0.2;
      if (ctx.preferences.topics.length > 0 && shared.length === 0) reasons.push("Different interests from yours");
      if (c.id === "riley" || c.id === "morgan" || c.id === "maya") reasons.push("Asks the questions nobody else does");
    }

    if (ctx.mode !== "surprise" && shared.length > 0) {
      score += Math.min(shared.length, 3) * 1.0;
      const names = shared.slice(0, 2).map((t) => TOPIC_LABELS[t]);
      reasons.unshift(`You both like ${names.join(" and ")}`);
    }

    const vibe = ctx.preferences.vibe;
    if (vibe !== "any") {
      const fits =
        (vibe === "funny" && c.humour >= 4) ||
        (vibe === "thoughtful" && c.depth >= 4) ||
        (vibe === "outgoing" && c.energy >= 4);
      if (fits) {
        score += 2;
        reasons.push(vibe === "funny" ? "Funny, as you asked" : vibe === "thoughtful" ? "Thoughtful, as you asked" : "Outgoing, as you asked");
      }
    }

    if (ctx.preferences.depth === "quick") score += (5 - c.depth) * 0.3;
    if (ctx.preferences.depth === "deeper") score += c.depth * 0.3;

    const recentIndex = ctx.recentCharacterIds.indexOf(c.id);
    if (recentIndex === 0) score -= 3;
    else if (recentIndex === 1) score -= 1.5;

    score += ctx.rng() * (ctx.mode === "surprise" ? 3 : 1.5);

    results.push({ character: c, score, reasons: reasons.slice(0, 2) });
  }

  return results.sort((a, b) => b.score - a.score);
}

export function findMatch(ctx: MatchContext): MatchResult | undefined {
  const ranked = rankCandidates(ctx);
  if (ranked.length === 0) return undefined;
  // Never hand back the character the user just left when anyone else is available.
  const last = ctx.recentCharacterIds[0];
  const notLast = ranked.find((r) => r.character.id !== last);
  return notLast ?? ranked[0];
}
