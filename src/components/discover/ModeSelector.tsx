"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame, Shuffle, Zap, type LucideIcon } from "lucide-react";
import type { Mode } from "@/lib/characters/types";
import { MODE_COPY } from "@/lib/matching";
import { cn } from "@/lib/utils/cn";

const MODES: Mode[] = ["bored", "warmup", "surprise"];
const ICONS: Record<Mode, LucideIcon> = { bored: Zap, warmup: Flame, surprise: Shuffle };

interface Props {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
  /** Compact single-row variant for forms. */
  dense?: boolean;
}

/**
 * Three ways in. One tap to choose, one tap to go. The highlight slides
 * between cards so a change reads as a choice, not a reload.
 */
export function ModeSelector({ value, onChange, disabled, dense = false }: Props) {
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label="What are you in the mood for?" className={cn("grid w-full grid-cols-3 gap-2", disabled && "opacity-60")}>
      {MODES.map((mode) => {
        const selected = mode === value;
        const Icon = ICONS[mode];
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              "relative isolate flex min-w-0 items-center justify-center rounded-lg border px-1 text-[13px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed",
              dense ? "h-11 flex-row gap-1.5" : "h-[66px] flex-col gap-1.5 short:h-[56px] short:gap-1",
              selected ? "border-accent/80 text-ink" : "border-line bg-surface/50 text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {selected && (
              <motion.span
                layoutId={dense ? "mood-dense" : "mood"}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-lg bg-accent-soft"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            <Icon className={cn("shrink-0", dense ? "size-4" : "size-[18px]", selected ? "text-accent" : "text-ink-3")} strokeWidth={selected ? 2.4 : 2} aria-hidden="true" />
            <span className="truncate leading-none">{MODE_COPY[mode].label}</span>
          </button>
        );
      })}
    </div>
  );
}
