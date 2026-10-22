"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MatchResult } from "@/lib/matching";
import { TOPIC_LABELS } from "@/lib/characters/topics";
import { Avatar } from "@/components/ui/Avatar";
import { AILabel } from "@/components/ui/AILabel";
import { Button } from "@/components/ui/Button";

interface Props {
  match: MatchResult;
  connecting: boolean;
  error?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

/** One person, one sentence about them, one big button. */
export function MatchCard({ match, connecting, error, onAccept, onDecline }: Props) {
  const reduce = useReducedMotion();
  const { character, reasons } = match;
  return (
    <motion.section
      aria-label={`Meet ${character.name}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-[30px] bg-[linear-gradient(180deg,#191c27,#12141c)] p-5 text-center shadow-card"
    >
      <div className="mx-auto w-fit rounded-full p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(106,98,239,0.55)]">
        <Avatar name={character.name} hue={character.hue} size="xl" />
      </div>
      <h2 className="display mt-4 text-[32px] leading-none text-ink">{character.name}</h2>
      <div className="mt-2.5 flex items-center justify-center gap-2">
        <AILabel long />
        <span className="text-sm text-ink-3">{character.role}</span>
      </div>

      <p className="mx-auto mt-4 max-w-[34ch] text-[15px] leading-relaxed text-ink-2">{character.bio}</p>

      {reasons.length > 0 && <p className="mt-3 text-sm font-medium text-accent">{reasons[0]}</p>}

      <ul className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Interests">
        {character.interests.slice(0, 3).map((t) => (
          <li key={t} className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            {TOPIC_LABELS[t]}
          </li>
        ))}
      </ul>

      {error && (
        <p role="status" className="mt-4 text-sm font-medium text-warning">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-1">
        <Button size="lg" block loading={connecting} onClick={onAccept}>
          {connecting ? "Opening" : "Start chatting"}
        </Button>
        <Button variant="ghost" block disabled={connecting} onClick={onDecline}>
          Someone else
        </Button>
      </div>
    </motion.section>
  );
}
