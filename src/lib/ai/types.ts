import type { Character, Mode } from "@/lib/characters/types";
import type { Memory } from "@/lib/engine/memory";
import type { ChatContext, HistoryTurn } from "./prompt";
import type { ChatUsage } from "./protocol";

export interface TurnRequest {
  character: Character;
  mode: Mode;
  kind: "opening" | "reply";
  /** Oldest first, user and character turns only. For a reply it ends with the user's latest message(s). */
  history: HistoryTurn[];
  /** The local engine's per-conversation memory. */
  memory: Memory;
  context: ChatContext;
  /** Stable per conversation. */
  seed?: number;
  signal?: AbortSignal;
  /** Called once per message bubble, as soon as it's ready. */
  onBubble: (text: string) => void;
}

export interface TurnResult {
  memory: Memory;
  source: "local" | "model";
  firstMs?: number | null;
  totalMs?: number;
  usage?: ChatUsage;
}

export interface ConversationEngine {
  readonly name: "local" | "model";
  turn(req: TurnRequest): Promise<TurnResult>;
}

export type { HistoryTurn };
