"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/characters/types";
import { describeError, peopleApi, type MatchState } from "@/components/people/api";
import { track } from "@/lib/analytics/track";

/** How long to look before offering AI as an option. Configurable per deployment. */
export const MATE_WAIT_MS = (Number(process.env.NEXT_PUBLIC_HELLO_MATE_WAIT_SECONDS) || 45) * 1000;
const POLL_MS = 2500;

export type MateView =
  | { phase: "idle" }
  | { phase: "looking"; match?: MatchState; timedOut: boolean; error?: string }
  | { phase: "connected"; conversationId: string; withName: string };

/**
 * Drives "Chat with a mate". Polls the server while looking; the server keeps
 * the person visible, asks one available member at a time and reports when
 * someone accepts. Stopping (or leaving the screen) withdraws everything.
 */
export function useMateMatch(mode: Mode) {
  const [view, setView] = useState<MateView>({ phase: "idle" });
  const since = useRef(0);
  const startedAt = useRef(0);
  const active = useRef(false);
  const failures = useRef(0);

  const poll = useCallback(async () => {
    if (!active.current) return;
    try {
      const match = await peopleApi.match(mode, since.current);
      if (!active.current) return;
      failures.current = 0;
      if (match.state === "connected") {
        active.current = false;
        track("conversation_started", { mode, source: "human", conversationId: match.conversationId });
        setView({ phase: "connected", conversationId: match.conversationId, withName: match.withName });
        return;
      }
      setView((v) => ({ phase: "looking", match, timedOut: v.phase === "looking" ? v.timedOut : false }));
    } catch (e) {
      failures.current += 1;
      if (failures.current === 2) track("conversation_start_failed", { mode, source: "human", reason: "unreachable" });
      if (failures.current >= 2) setView((v) => (v.phase === "looking" ? { ...v, error: describeError(e, "Can't reach hello right now. Still trying…") } : v));
    }
  }, [mode]);

  useEffect(() => {
    if (view.phase !== "looking") return;
    const t = window.setTimeout(() => void poll(), POLL_MS);
    return () => window.clearTimeout(t);
  }, [view, poll]);

  // Offer AI once nobody has picked up in time, but only while genuinely waiting.
  useEffect(() => {
    if (view.phase !== "looking" || view.timedOut) return;
    const waitingForNobody = !view.match || view.match.state === "waiting";
    if (!waitingForNobody) return;
    const left = MATE_WAIT_MS - (Date.now() - startedAt.current);
    const t = window.setTimeout(() => setView((v) => (v.phase === "looking" ? { ...v, timedOut: true } : v)), Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [view]);

  const start = useCallback(() => {
    active.current = true;
    failures.current = 0;
    since.current = Date.now() - 1000;
    startedAt.current = Date.now();
    setView({ phase: "looking", timedOut: false });
    void poll();
  }, [poll]);

  const keepLooking = useCallback(() => {
    startedAt.current = Date.now();
    setView((v) => (v.phase === "looking" ? { ...v, timedOut: false } : v));
  }, []);

  const stop = useCallback(() => {
    if (active.current) void peopleApi.cancelMatch().catch(() => undefined);
    active.current = false;
    setView({ phase: "idle" });
  }, []);

  const respond = useCallback(
    async (requestId: string, action: "accept" | "decline") => {
      try {
        const res = await peopleApi.answerRequest(requestId, action);
        if (action === "accept" && res.conversationId) {
          active.current = false;
          track("conversation_started", { mode, source: "human", conversationId: res.conversationId });
          setView({ phase: "connected", conversationId: res.conversationId, withName: "" });
          return;
        }
        void poll();
      } catch (e) {
        if (action === "accept") track("conversation_start_failed", { mode, source: "human", reason: "request_unavailable" });
        setView((v) => (v.phase === "looking" ? { ...v, error: describeError(e, "That request is no longer available.") } : v));
        void poll();
      }
    },
    [poll, mode],
  );

  // Leaving the screen while looking withdraws the request and availability.
  useEffect(() => {
    const leave = () => {
      if (active.current) void peopleApi.cancelMatch().catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
      active.current = false;
    };
  }, []);

  return { view, start, stop, keepLooking, respond };
}
