"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Shuffle, Sun, Zap, type LucideIcon } from "lucide-react";
import type { Mode } from "@/lib/characters/types";
import { MODE_COPY } from "@/lib/matching";
import { cn } from "@/lib/utils/cn";

const MODES: Mode[] = ["bored", "warmup", "surprise"];
const ICONS: Record<Mode, LucideIcon> = { bored: Zap, warmup: Sun, surprise: Shuffle };

interface Props {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
  /** Single-row variant for forms. */
  dense?: boolean;
}

/** A segmented control: one track, one raised thumb that slides to your choice. */
export function ModeSelector({ value, onChange, disabled, dense = false }: Props) {
  const reduce = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label="What are you in the mood for?"
      className={cn(
        "grid w-full grid-cols-3 gap-1 rounded-[22px] bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06),0_1px_0_rgba(255,255,255,0.04)]",
        disabled && "opacity-60",
      )}
    >
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
              "relative isolate flex min-w-0 items-center justify-center rounded-[18px] px-1 text-[13px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed",
              dense ? "h-11 flex-row gap-1.5" : "h-[60px] flex-col gap-1 short:h-[52px]",
              selected ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {selected && (
              <motion.span
                layoutId={dense ? "mood-dense" : "mood"}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-[18px] bg-[linear-gradient(180deg,#2c3040,#22263a)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.45)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className={cn("shrink-0", dense ? "size-4" : "size-[18px]", selected ? "text-accent" : "")} strokeWidth={2.2} aria-hidden="true" />
            <span className="truncate leading-none">{MODE_COPY[mode].label}</span>
          </button>
        );
      })}
    </div>
  );
}
