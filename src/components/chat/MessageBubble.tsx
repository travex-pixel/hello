"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Message } from "@/lib/conversation/types";
import { cn } from "@/lib/utils/cn";

interface Props {
  message: Message;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: Props) {
  const reduce = useReducedMotion();
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
          "max-w-[82%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2.5 text-[15px] leading-relaxed",
          mine ? "rounded-br-[6px] bg-cobalt-deep text-white" : "rounded-bl-[6px] border border-line bg-surface text-ink",
          (message.status === "failed" || message.status === "sending") && "opacity-70",
        )}
      >
        {message.text}
      </div>
      {message.status === "sending" && <span className="mt-1 text-[11px] text-ink-3">Sending…</span>}
      {message.status === "failed" && (
        <button type="button" onClick={onRetry} className="mt-1 text-xs text-danger underline-offset-2 hover:underline">
          Not sent. Tap to retry
        </button>
      )}
    </motion.div>
  );
}
