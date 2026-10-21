"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  searching: boolean;
  onPress: () => void;
  label?: string;
  /** Read out while busy. */
  busyLabel?: string;
}

/* Three small sparks around the button. Positions are percentages of the glow box. */
const SPARKS = [
  { left: "14%", top: "22%", size: 6, color: "bg-coral-light", delay: "0s" },
  { left: "84%", top: "30%", size: 4, color: "bg-mint-ink", delay: "1.2s" },
  { left: "76%", top: "84%", size: 5, color: "bg-cobalt-light", delay: "2.3s" },
];

/**
 * The signature interaction: a coral speech bubble you press to start a
 * conversation. Idle: a slow breathing glow and a few quiet sparks.
 * Pressed: immediate squash. Searching: the button is disabled (so a second
 * tap cannot start a second request) and rings run until a match is ready.
 */
export function ConnectButton({ searching, onPress, label = "Start a conversation", busyLabel = "Finding someone" }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow, breathing slowly while idle. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute size-[calc(var(--orb)*1.32)] rounded-full bg-[radial-gradient(circle,rgba(255,107,87,0.36)_0%,rgba(255,107,87,0.1)_46%,transparent_70%)]",
          !searching && "animate-breathe",
        )}
      >
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className={cn("absolute rounded-full", s.color, !searching && "animate-spark")}
            style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, opacity: searching ? 0 : undefined }}
          />
        ))}
      </div>
      {searching &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute size-[var(--orb)] rounded-full border-2 border-coral/60"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={reduce ? { opacity: [0.6, 0.2, 0.6] } : { scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: reduce ? 1.2 : 1.6, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      <motion.button
        type="button"
        onClick={onPress}
        disabled={searching}
        aria-label={searching ? busyLabel : label}
        aria-busy={searching || undefined}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        whileHover={reduce || searching ? undefined : { scale: 1.015 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn(
          "orb-button group relative isolate flex size-[var(--orb)] items-center justify-center rounded-full",
          searching && "cursor-default",
        )}
      >
        {/* The tail that turns the circle into a speech bubble. It sits under the disc, so only the tip shows. */}
        <span aria-hidden="true" className="absolute bottom-[3%] left-[8%] z-0 size-[18%] rotate-45 rounded-[16%] bg-[#e8503c]" />
        <span
          aria-hidden="true"
          className="absolute inset-0 z-10 rounded-full bg-[radial-gradient(115%_115%_at_32%_22%,#ffa08f_0%,#ff6b57_48%,#e8503c_100%)] shadow-orb transition-[filter] duration-200 group-hover:brightness-105 group-active:brightness-95"
        />
        <span aria-hidden="true" className="absolute inset-[7px] z-10 rounded-full border border-white/30" />
        <motion.span
          aria-hidden="true"
          className="relative z-20 flex max-w-[80%] flex-col items-center gap-2 text-balance text-[clamp(11.5px,3.4vw,14px)] font-semibold uppercase leading-[1.25] tracking-[0.16em] text-ink-inverse"
          animate={{ opacity: searching ? 0 : 1, scale: searching ? 0.9 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {label}
          <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.6} />
        </motion.span>
        {searching && (
          <motion.span
            aria-hidden="true"
            className="absolute z-20 size-3 rounded-full bg-ink-inverse"
            animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>
    </div>
  );
}
