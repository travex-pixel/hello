"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Props {
  starters: string[];
  onPick: (text: string) => void;
  hint?: string;
}

export function Starters({ starters, onPick, hint }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="px-3 pb-2"
    >
      {hint && <p className="mb-1.5 px-1 text-xs text-ink-3">{hint}</p>}
      <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3">
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-[42px] shrink-0 rounded-full bg-white/[0.05] px-4 py-2 text-sm text-ink-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.09] hover:text-ink active:bg-white/[0.03]"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
