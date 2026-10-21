import { describe, expect, it } from "vitest";
import { computeFunnel } from "./funnel";
import type { AnalyticsEvent } from "./events";

const ev = (name: AnalyticsEvent["name"], session: string, props?: AnalyticsEvent["props"]): AnalyticsEvent => ({ name, session, ts: 0, props });

describe("computeFunnel", () => {
  it("counts sessions through each step without double counting", () => {
    const events = [
      ev("landing_viewed", "a"),
      ev("discovery_tapped", "a"),
      ev("discovery_tapped", "a"),
      ev("connection_accepted", "a", { mode: "bored" }),
      ev("conversation_started", "a", { mode: "bored", source: "ai" }),
      ev("first_message_sent", "a", { msSinceAccept: 4000 }),
      ev("first_response_received", "a"),
      ev("conversation_reached_5", "a"),
      ev("feedback_submitted", "a", { feedback: "great" }),
      ev("landing_viewed", "b"),
      ev("discovery_tapped", "b"),
      ev("connection_accepted", "b", { mode: "warmup" }),
      ev("conversation_start_failed", "b", { mode: "warmup", source: "ai", reason: "open_failed" }),
      ev("conversation_started", "b", { mode: "warmup", source: "ai" }),
      ev("first_message_sent", "b", { msSinceAccept: 8000 }),
      ev("landing_viewed", "c"),
    ];
    const r = computeFunnel(events);
    expect(r.sessions).toBe(3);
    expect(r.sessionsWithTap).toBe(2);
    expect(r.sessionsWithConnection).toBe(2);
    expect(r.sessionsWithFirstMessage).toBe(2);
    expect(r.sessionsWithResponse).toBe(1);
    expect(r.conversationsStarted).toBe(2);
    expect(r.conversationStartFailures).toBe(1);
    expect(r.conversationsReachedFive).toBe(1);
    expect(r.feedback.great).toBe(1);
    expect(r.modeSelections).toEqual({ bored: 1, warmup: 1 });
    expect(r.medianMsToFirstMessage).toBe(6000);
  });

  it("handles no data", () => {
    const r = computeFunnel([]);
    expect(r.sessions).toBe(0);
    expect(r.medianMsToFirstMessage).toBeNull();
  });
});
