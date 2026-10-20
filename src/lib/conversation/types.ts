import type { Mode } from "@/lib/characters/types";
import type { Memory } from "@/lib/engine/memory";

export type Feedback = "great" | "fine" | "not_for_me";

export interface Message {
  id: string;
  role: "user" | "character" | "system";
  text: string;
  ts: number;
  status?: "sending" | "sent" | "failed";
}

export interface Conversation {
  id: string;
  characterId: string;
  mode: Mode;
  /** Only "ai" exists in the demo. Human conversations live in the network module. */
  source: "ai";
  startedAt: number;
  endedAt?: number;
  messages: Message[];
  memory: Memory;
  feedback?: Feedback;
  /** Milestones already tracked, so analytics events fire once. */
  milestones: { firstMessage?: boolean; firstResponse?: boolean; reachedFive?: boolean };
}

export interface Report {
  id: string;
  conversationId: string;
  characterId: string;
  reason: string;
  ts: number;
}
