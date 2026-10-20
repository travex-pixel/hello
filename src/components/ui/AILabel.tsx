import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Always visible wherever an AI character appears. */
export function AILabel({ long = false, className }: { long?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent/35 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-strong",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {long ? "AI character" : "AI"}
    </span>
  );
}
