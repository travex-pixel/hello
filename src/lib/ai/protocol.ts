import type { ChatContext, HistoryTurn } from "./prompt";

/** Body of POST /api/chat. Everything the server needs; it keeps no state between requests. */
export interface ChatRequest {
  characterId: string;
  mode: string;
  /** "opening": the character's first message. "reply": answer the latest user message(s). */
  kind: "opening" | "reply";
  /** Oldest first. The server uses the most recent MAX_HISTORY_TURNS. */
  history: HistoryTurn[];
  context: ChatContext;
  /** Stable per conversation: varies opinions and openings between chats. */
  seed?: number;
}

export type ChatErrorCode = "not_configured" | "bad_request" | "rate_limited" | "timeout" | "empty" | "refused" | "upstream" | "unavailable";

/** One line of the NDJSON response stream. */
export type ChatStreamEvent =
  | { type: "bubble"; text: string }
  | { type: "done"; firstMs: number | null; totalMs: number; usage?: ChatUsage }
  | { type: "error"; code: ChatErrorCode };

export interface ChatUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ChatStatus {
  configured: boolean;
}

export const LIMITS = {
  /** Accepted per request; the prompt keeps the latest 60. */
  history: 120,
  messageChars: 1000,
  memories: 30,
  noteChars: 160,
  notes: 20,
  nameChars: 30,
  styleAbout: 200,
  styleExamples: 3,
  styleExampleChars: 160,
  localTime: 40,
} as const;
