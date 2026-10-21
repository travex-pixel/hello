"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { findMatch, type MatchResult } from "@/lib/matching";
import { useHello } from "@/lib/conversation/store";
import { track } from "@/lib/analytics/track";
import { mulberry32 } from "@/lib/utils/rng";

/**
 * The reveal animation runs for this long. Matching itself is instant and
 * local; this is the length of the transition, not simulated latency.
 */
export const DISCOVERY_REVEAL_MS = 1100;
const DISCOVERY_REVEAL_REDUCED_MS = 250;

export const START_FAILED_MESSAGE = "Couldn't start that conversation. Nothing was sent. Please try again.";

export type DiscoveryState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; match: MatchResult }
  | { status: "connecting"; match: MatchResult }
  | { status: "empty" };

export function useDiscovery() {
  const router = useRouter();
  const [state, setState] = useState<DiscoveryState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const declinedRef = useRef<string[]>([]);
  const runRef = useRef(0);
  const busyRef = useRef(false);

  const mode = useHello((s) => s.mode);
  const preferences = useHello((s) => s.preferences);
  const recent = useHello((s) => s.recentCharacterIds);
  const blocked = useHello((s) => s.blockedCharacterIds);
  const reduced = useHello((s) => s.reducedMotion);
  const startConversation = useHello((s) => s.startConversation);
  const autoStart = useHello((s) => s.autoStart);
  const setAutoStart = useHello((s) => s.setAutoStart);

  const start = useCallback(async () => {
    // A second tap before the first has rendered must not start a second search.
    if (busyRef.current) return;
    busyRef.current = true;
    const run = ++runRef.current;
    setError(null);
    track("discovery_tapped", { mode, source: "ai" });
    setState({ status: "searching" });
    try {
      const match = findMatch({
        mode,
        preferences,
        recentCharacterIds: [...declinedRef.current, ...recent],
        blockedCharacterIds: blocked,
        rng: mulberry32((Date.now() ^ (run * 2654435761)) >>> 0),
      });
      await new Promise((r) => setTimeout(r, reduced ? DISCOVERY_REVEAL_REDUCED_MS : DISCOVERY_REVEAL_MS));
      if (run !== runRef.current) return;
      if (!match) {
        track("no_candidates", { mode });
        setState({ status: "empty" });
        return;
      }
      track("character_presented", { mode, characterId: match.character.id });
      setState({ status: "found", match });
    } catch {
      if (run !== runRef.current) return;
      track("conversation_start_failed", { mode, source: "ai", reason: "match_failed" });
      setError(START_FAILED_MESSAGE);
      setState({ status: "idle" });
    } finally {
      if (run === runRef.current) busyRef.current = false;
    }
  }, [mode, preferences, recent, blocked, reduced]);

  const tryAnother = useCallback(() => {
    if (state.status !== "found") return;
    track("connection_declined", { mode, characterId: state.match.character.id });
    declinedRef.current = [state.match.character.id, ...declinedRef.current].slice(0, 3);
    void start();
  }, [state, mode, start]);

  const accept = useCallback(async () => {
    if (state.status !== "found") return;
    const { match } = state;
    setError(null);
    setState({ status: "connecting", match });
    track("connection_accepted", { mode, characterId: match.character.id });
    try {
      const id = await startConversation(match.character.id, mode);
      track("conversation_started", { mode, characterId: match.character.id, conversationId: id, source: "ai" });
      router.push(`/chat/${id}`);
      // Next keeps this screen mounted but hidden during navigation; reset it
      // now so coming back lands on the idle hero, not a stale card.
      declinedRef.current = [];
      setState({ status: "idle" });
    } catch {
      track("conversation_start_failed", { mode, characterId: match.character.id, source: "ai", reason: "open_failed" });
      setError(START_FAILED_MESSAGE);
      setState({ status: "found", match });
    }
  }, [state, mode, startConversation, router]);

  const reset = useCallback(() => {
    runRef.current += 1;
    busyRef.current = false;
    declinedRef.current = [];
    setError(null);
    setState({ status: "idle" });
  }, []);

  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // "Meet someone else" lands here with autoStart set: begin on the next tick.
  // Clearing the flag re-runs this effect, so the scheduled start must not be
  // cancelled by a cleanup.
  useEffect(() => {
    if (!autoStart) return;
    setAutoStart(false);
    track("another_conversation_started", { mode });
    window.setTimeout(() => void startRef.current(), 0);
  }, [autoStart, setAutoStart, mode]);

  return { state, error, start, tryAnother, accept, reset };
}
