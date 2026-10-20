import type { Character, Mode } from "@/lib/characters/types";
import type { Memory } from "@/lib/engine/memory";

export interface HistoryItem {
  role: "user" | "character";
  text: string;
}

export interface ReplyRequest {
  character: Character;
  mode: Mode;
  memory: Memory;
  /** Oldest first, user and character turns only. */
  history: HistoryItem[];
  userMessage: string;
}

export interface OpeningRequest {
  character: Character;
  mode: Mode;
  memory: Memory;
}

export interface ReplyResult {
  messages: string[];
  memory: Memory;
  /** Where the words came from. Shown nowhere, logged in dev. */
  source: "local" | "server";
}

export interface AiProvider {
  readonly name: string;
  opening(req: OpeningRequest): Promise<ReplyResult>;
  reply(req: ReplyRequest): Promise<ReplyResult>;
}
