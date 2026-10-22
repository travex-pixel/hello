"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Message } from "@/lib/conversation/types";
import { CRISIS_RESOURCES } from "@/lib/safety/crisis";
import { cn } from "@/lib/utils/cn";

interface Props {
  message: Message;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: Props) {
  const reduce = useReducedMotion();
  if (message.role === "system" && message.kind === "safety") {
    return (
      <section role="note" aria-label={CRISIS_RESOURCES.title} className="mx-auto w-full max-w-[92%] rounded-2xl bg-surface-2 p-4 text-left shadow-[inset_0_0_0_1px_rgba(111,227,182,0.35)]">
        <p className="text-[15px] font-semibold text-ink">{CRISIS_RESOURCES.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{CRISIS_RESOURCES.body}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {CRISIS_RESOURCES.lines.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="inline-flex min-h-[40px] items-center text-[15px] font-medium text-mint-ink underline underline-offset-4" {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-ink-3">This message is from HELLO, not the character.</p>
      </section>
    );
  }
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-[85%] px-2 py-1 text-center text-xs leading-relaxed text-ink-3">{message.text}</p>
    );
  }
  const mine = message.role === "user";
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col", mine ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "max-w-[82%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[16px] leading-relaxed",
          mine ? "rounded-br-[6px] bg-[linear-gradient(180deg,#5d63ee,#4a50de)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_16px_-8px_rgba(79,86,227,0.7)]" : "rounded-bl-[6px] bg-surface-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.06)]",
          (message.status === "failed" || message.status === "sending") && "opacity-70",
        )}
      >
        {message.text}
      </div>
      {message.status === "sending" && <span className="mt-1 text-[11px] text-ink-3">Sending…</span>}
      {message.status === "failed" && (
        <button type="button" onClick={onRetry} className="mt-1 min-h-[32px] text-xs text-danger underline-offset-2 hover:underline">
          Not sent. Tap to retry
        </button>
      )}
      {message.replyFailed && message.status !== "failed" && (
        <button type="button" onClick={onRetry} className="mt-1 min-h-[32px] text-xs text-danger underline-offset-2 hover:underline">
          No reply. Tap to retry
        </button>
      )}
    </motion.div>
  );
}
