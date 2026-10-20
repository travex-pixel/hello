import type { TopicId } from "@/lib/characters/topics";

export type MoveType =
  | "opening"
  | "ask_topic"
  | "ask_easy"
  | "ask_open"
  | "ask_surprise"
  | "hook"
  | "share"
  | "answer"
  | "callback"
  | "react"
  | "farewell";

export interface RememberedLike {
  text: string;
  topic?: TopicId;
  turn: number;
  calledBack: boolean;
}

export interface RememberedFact {
  text: string;
  turn: number;
  calledBack: boolean;
}

/**
 * Bounded, per-conversation memory. Everything here is derived from what the
 * user typed in this session and is stored locally with the conversation.
 */
export interface Memory {
  userName?: string;
  likes: RememberedLike[];
  dislikes: string[];
  facts: RememberedFact[];
  /** Topic -> how many times it came up and the last user turn it did. */
  topics: Partial<Record<TopicId, { count: number; lastTurn: number }>>;
  /** Hashes of lines already used, to avoid repeating ourselves. */
  usedLines: string[];
  /** Number of user messages so far. */
  turn: number;
  /** What the character did last, so short replies can be read as answers. */
  lastMove?: { type: MoveType; topic?: TopicId; askedQuestion: boolean };
  /** Consecutive character replies that didn't ask anything. */
  repliesWithoutQuestion: number;
  /** Consecutive low-effort user replies. */
  lowEffortStreak: number;
  /** Consecutive character replies that ended with a question. */
  questionStreak: number;
  /** Rolling user message lengths, to mirror energy. */
  userLengths: number[];
  jokesTold: number;
  factsTold: number;
}

export const MAX_USED_LINES = 240;
export const MAX_LIKES = 12;
export const MAX_FACTS = 12;

export function createMemory(): Memory {
  return {
    likes: [],
    dislikes: [],
    facts: [],
    topics: {},
    usedLines: [],
    turn: 0,
    repliesWithoutQuestion: 0,
    lowEffortStreak: 0,
    questionStreak: 0,
    userLengths: [],
    jokesTold: 0,
    factsTold: 0,
  };
}

export function rememberLike(memory: Memory, text: string, topic?: TopicId, turn = memory.turn) {
  const key = text.toLowerCase();
  if (memory.likes.some((l) => l.text.toLowerCase() === key)) return;
  memory.likes.push({ text, topic, turn, calledBack: false });
  if (memory.likes.length > MAX_LIKES) memory.likes.shift();
}

export function rememberFact(memory: Memory, text: string, turn = memory.turn) {
  const key = text.toLowerCase();
  if (memory.facts.some((f) => f.text.toLowerCase() === key)) return;
  memory.facts.push({ text, turn, calledBack: false });
  if (memory.facts.length > MAX_FACTS) memory.facts.shift();
}

export function rememberTopic(memory: Memory, topic: TopicId, turn = memory.turn) {
  const entry = memory.topics[topic] ?? { count: 0, lastTurn: 0 };
  entry.count += 1;
  entry.lastTurn = turn;
  memory.topics[topic] = entry;
}

export function markUsed(memory: Memory, hash: string) {
  memory.usedLines.push(hash);
  if (memory.usedLines.length > MAX_USED_LINES) memory.usedLines.shift();
}

export function averageUserLength(memory: Memory): number {
  if (memory.userLengths.length === 0) return 6;
  return memory.userLengths.reduce((a, b) => a + b, 0) / memory.userLengths.length;
}

export type Phase = "opening" | "warming" | "flowing" | "settled";

export function phaseOf(memory: Memory): Phase {
  if (memory.turn <= 1) return "opening";
  if (memory.turn <= 4) return "warming";
  if (memory.turn <= 10) return "flowing";
  return "settled";
}

/** Something the user said earlier that we haven't brought back yet. */
export function pendingCallback(memory: Memory): { kind: "like" | "fact"; text: string; topic?: TopicId; index: number } | undefined {
  const minAge = 2;
  for (let i = memory.likes.length - 1; i >= 0; i--) {
    const like = memory.likes[i];
    if (!like.calledBack && memory.turn - like.turn >= minAge) {
      return { kind: "like", text: like.text, topic: like.topic, index: i };
    }
  }
  for (let i = memory.facts.length - 1; i >= 0; i--) {
    const fact = memory.facts[i];
    if (!fact.calledBack && memory.turn - fact.turn >= minAge) {
      return { kind: "fact", text: fact.text, index: i };
    }
  }
  return undefined;
}
