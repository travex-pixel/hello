import type { AnalyticsEvent } from "./events";

export interface FunnelReport {
  sessions: number;
  sessionsWithTap: number;
  sessionsWithConnection: number;
  sessionsWithFirstMessage: number;
  sessionsWithResponse: number;
  /** Conversations that actually opened (AI or a real person). */
  conversationsStarted: number;
  conversationStartFailures: number;
  conversationsReachedFive: number;
  conversationsEnded: number;
  anotherConversationStarted: number;
  feedback: { great: number; fine: number; not_for_me: number };
  modeSelections: Record<string, number>;
  medianMsToFirstMessage: number | null;
  returnVisits: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pure funnel computation so it can be tested without a browser. */
export function computeFunnel(events: AnalyticsEvent[]): FunnelReport {
  const by = (name: AnalyticsEvent["name"]) => events.filter((e) => e.name === name);
  const sessionsOf = (name: AnalyticsEvent["name"]) => new Set(by(name).map((e) => e.session));
  const sessions = new Set(events.map((e) => e.session));
  const feedback = { great: 0, fine: 0, not_for_me: 0 };
  for (const e of by("feedback_submitted")) {
    const f = e.props?.feedback;
    if (f) feedback[f] += 1;
  }
  const modeSelections: Record<string, number> = {};
  for (const e of by("connection_accepted")) {
    const m = e.props?.mode ?? "unknown";
    modeSelections[m] = (modeSelections[m] ?? 0) + 1;
  }
  return {
    sessions: sessions.size,
    sessionsWithTap: sessionsOf("discovery_tapped").size,
    sessionsWithConnection: sessionsOf("connection_accepted").size,
    sessionsWithFirstMessage: sessionsOf("first_message_sent").size,
    sessionsWithResponse: sessionsOf("first_response_received").size,
    conversationsStarted: by("conversation_started").length,
    conversationStartFailures: by("conversation_start_failed").length,
    conversationsReachedFive: by("conversation_reached_5").length,
    conversationsEnded: by("conversation_ended").length,
    anotherConversationStarted: by("another_conversation_started").length,
    feedback,
    modeSelections,
    medianMsToFirstMessage: median(by("first_message_sent").map((e) => e.props?.msSinceAccept ?? NaN).filter((n) => !Number.isNaN(n))),
    returnVisits: by("return_visit").length,
  };
}
