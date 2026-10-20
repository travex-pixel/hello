"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface Props {
  searching: boolean;
  onPress: () => void;
  label?: string;
}

/**
 * The signature interaction. Idle: a slow ambient glow. Pressed: immediate
 * tactile feedback. Searching: concentric rings driven by the real discovery
 * state, which ends the moment a match is ready.
 */
export function ConnectButton({ searching, onPress, label = "Say hello" }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute size-[clamp(260px,78vw,330px)] rounded-full bg-[radial-gradient(circle,rgba(111,124,255,0.28)_0%,rgba(111,124,255,0.06)_45%,transparent_70%)]",
          !searching && "animate-pulse-soft",
        )}
      />
      {/* Discovery rings */}
      {searching &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute size-[clamp(200px,60vw,256px)] rounded-full border border-accent/50"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={reduce ? { opacity: [0.55, 0.2, 0.55] } : { scale: [1, 1.85], opacity: [0.55, 0] }}
            transition={{ duration: reduce ? 1.2 : 1.6, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      <motion.button
        type="button"
        onClick={onPress}
        disabled={searching}
        aria-label={searching ? "Finding someone" : label}
        aria-busy={searching || undefined}
        whileTap={reduce ? undefined : { scale: 0.955 }}
        whileHover={reduce || searching ? undefined : { scale: 1.015 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className={cn(
          "relative isolate flex size-[clamp(200px,60vw,256px)] items-center justify-center rounded-full outline-none",
          "bg-[radial-gradient(120%_120%_at_35%_25%,#8d98ff_0%,#6f7cff_45%,#3f4bd6_100%)]",
          "shadow-[0_0_0_1px_rgba(141,152,255,0.35),0_30px_80px_-30px_rgba(111,124,255,0.9),0_2px_0_rgba(255,255,255,0.25)_inset]",
          "focus-visible:ring-4 focus-visible:ring-accent/50",
          searching && "cursor-default",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[6px] rounded-full border border-white/15"
        />
        <motion.span
          className="relative text-[15px] font-semibold uppercase tracking-[0.22em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
          animate={{ opacity: searching ? 0 : 1, scale: searching ? 0.9 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.span>
        {searching && (
          <motion.span
            aria-hidden="true"
            className="absolute size-3 rounded-full bg-white"
            animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>
    </div>
  );
}
