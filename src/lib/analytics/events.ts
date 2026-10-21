import type { Mode } from "@/lib/characters/types";

/**
 * Privacy-conscious product events. No message content, no identifiers beyond a
 * per-browser anonymous id. Stored locally by default; see sink.ts.
 */
export type EventName =
  | "landing_viewed"
  | "mode_selected"
  | "discovery_tapped"
  | "conversation_started"
  | "conversation_start_failed"
  | "character_presented"
  | "connection_accepted"
  | "connection_declined"
  | "no_candidates"
  | "first_message_sent"
  | "first_response_received"
  | "message_sent"
  | "conversation_reached_5"
  | "conversation_ended"
  | "feedback_submitted"
  | "another_conversation_started"
  | "return_visit"
  | "human_mode_viewed"
  | "human_mode_unavailable_shown";

export type EventProps = Partial<{
  mode: Mode;
  characterId: string;
  conversationId: string;
  source: "ai" | "human";
  feedback: "great" | "fine" | "not_for_me";
  messageCount: number;
  msSinceAccept: number;
  daysSinceLastVisit: number;
  /** A short category, never free text or message content. */
  reason: string;
}>;

export interface AnalyticsEvent {
  name: EventName;
  ts: number;
  /** Per page load. */
  session: string;
  props?: EventProps;
}
