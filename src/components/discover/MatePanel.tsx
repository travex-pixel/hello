"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { MateView } from "./useMateMatch";

interface Props {
  view: Extract<MateView, { phase: "looking" }>;
  onStop: () => void;
  onKeepLooking: () => void;
  onChooseAI: () => void;
  onRespond: (requestId: string, action: "accept" | "decline") => void;
}

/** Truthful status while looking for a real person. Never implies someone is there when they aren't. */
export function MatePanel({ view, onStop, onKeepLooking, onChooseAI, onRespond }: Props) {
  const reduce = useReducedMotion();
  const m = view.match;
  const fade = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24 },
  };

  if (m?.state === "incoming") {
    return (
      <motion.div {...fade} className="w-full rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-5 text-left shadow-card" role="alertdialog" aria-label={`${m.fromName} wants to say hello`}>
        <p className="text-[13px] font-semibold text-mint-ink">A real person</p>
        <h2 className="display mt-2 text-[30px] leading-tight text-ink">{m.fromName} wants to say hello</h2>
        <p className="mt-1 text-sm text-ink-3">Nothing starts unless you accept.</p>
        <div className="mt-4 flex flex-col gap-1.5">
          <Button size="lg" block onClick={() => onRespond(m.requestId, "accept")}>
            Say hello back
          </Button>
          <Button variant="ghost" block onClick={() => onRespond(m.requestId, "decline")}>
            Not right now
          </Button>
        </div>
      </motion.div>
    );
  }

  if (view.timedOut && (!m || m.state === "waiting")) {
    return (
      <motion.div {...fade} className="w-full rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-5 text-left shadow-card">
        <h2 className="display text-[28px] leading-tight text-ink">No mates free right now</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">You&rsquo;re still visible for a while. Or try an AI character, clearly labelled.</p>
        <div className="mt-4 flex flex-col gap-1.5">
          <Button size="lg" block onClick={onChooseAI}>
            Chat with AI instead
          </Button>
          <Button variant="secondary" block onClick={onKeepLooking}>
            Keep looking
          </Button>
          <Button variant="ghost" block onClick={onStop}>
            Stop looking
          </Button>
        </div>
      </motion.div>
    );
  }

  const headline = !m ? "Looking for a mate…" : m.state === "requested" ? `Asking ${m.toName}…` : "Looking for a mate…";
  const detail = !m
    ? "Checking who's around."
    : m.state === "requested"
      ? `${m.toName} is a real person from the beta. Waiting for them to accept.`
      : m.state === "waiting" && m.othersLooking > 0
        ? "Someone else is looking too. Asking them now…"
        : "Nobody else is looking right now. You're visible, so whoever taps next will find you.";

  return (
    <motion.div {...fade} className="flex w-full flex-col items-center" aria-live="polite">
      <p className="text-[15px] font-medium text-accent">{headline}</p>
      <p className="mt-1.5 max-w-[320px] text-sm text-ink-2">{detail}</p>
      {view.error && (
        <p role="status" className="mt-2 text-sm text-warning">
          {view.error}
        </p>
      )}
      <Button variant="ghost" className="mt-3" onClick={onStop}>
        Stop looking
      </Button>
    </motion.div>
  );
}
