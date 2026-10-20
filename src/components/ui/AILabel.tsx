import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Always visible wherever an AI character appears. Cobalt, never coral: it's information, not a call to action. */
export function AILabel({ long = false, className }: { long?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-cobalt-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cobalt-deep",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {long ? "AI character" : "AI"}
    </span>
  );
}
