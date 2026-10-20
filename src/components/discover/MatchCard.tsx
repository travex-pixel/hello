"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { MatchResult } from "@/lib/matching";
import { TOPIC_LABELS } from "@/lib/characters/topics";
import { Avatar } from "@/components/ui/Avatar";
import { AILabel } from "@/components/ui/AILabel";
import { Button } from "@/components/ui/Button";

interface Props {
  match: MatchResult;
  connecting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function MatchCard({ match, connecting, onAccept, onDecline }: Props) {
  const reduce = useReducedMotion();
  const { character, reasons } = match;
  return (
    <motion.section
      aria-label={`Meet ${character.name}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-xl border border-line bg-surface p-4 text-left shadow-card sm:p-5"
    >
      <div className="flex items-center gap-3.5">
        <Avatar name={character.name} hue={character.hue} size="lg" className="size-16 text-2xl sm:size-20 sm:text-3xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{character.name}</h2>
            <AILabel long />
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{character.role}</p>
        </div>
      </div>

      <p className="mt-3 text-[15px] leading-snug text-ink-2">{character.bio}</p>

      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Interests">
        {character.interests.slice(0, 4).map((t) => (
          <li key={t} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
            {TOPIC_LABELS[t]}
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-md bg-surface-2 px-3 py-2.5">
        <p className="text-sm leading-snug text-ink">{character.whyInteresting}</p>
        {reasons.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="flex items-center gap-2 text-xs text-ink-2">
                <Check className="size-3.5 shrink-0 text-accent-strong" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2.5 text-xs leading-snug text-ink-3">An AI character, not a real person. Replies are generated for this demo and stay on your device.</p>

      <div className="mt-3 flex flex-col gap-1.5">
        <Button size="lg" block loading={connecting} onClick={onAccept}>
          Say hello
        </Button>
        <Button variant="ghost" block disabled={connecting} onClick={onDecline}>
          Try someone else
        </Button>
      </div>
    </motion.section>
  );
}
