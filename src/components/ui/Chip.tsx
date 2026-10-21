"use client";

import type { ButtonHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected = false, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
        selected ? "border-accent bg-accent-soft text-ink" : "border-line-strong bg-surface-2 text-ink-2 hover:border-ink-3 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {selected && <Check className="size-3.5 text-accent" aria-hidden="true" />}
      {children}
    </button>
  );
}
