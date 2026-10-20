"use client";

import type { Mode } from "@/lib/characters/types";
import { MODE_COPY } from "@/lib/matching";
import { cn } from "@/lib/utils/cn";

const MODES: Mode[] = ["bored", "warmup", "surprise"];

interface Props {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

/** Three ways in. One tap to choose, one tap to go. */
export function ModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="What are you in the mood for?" className="flex w-full rounded-full bg-surface-2 p-1">
      {MODES.map((mode) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-full px-2 text-[14px] font-semibold transition-all duration-200 disabled:opacity-60",
              selected ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink",
            )}
          >
            {MODE_COPY[mode].label}
          </button>
        );
      })}
    </div>
  );
}
