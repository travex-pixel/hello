"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface Props {
  searching: boolean;
  onPress: () => void;
  label?: string;
}

/**
 * The signature interaction: a vermilion speech bubble you press to say
 * hello. Idle: a slow breathing glow. Pressed: immediate squash. Searching:
 * rings driven by the real discovery state, which ends when a match is ready.
 */
export function ConnectButton({ searching, onPress, label = "Say hello" }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow on the paper, breathing slowly while idle. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute size-[clamp(250px,74vw,320px)] rounded-full bg-[radial-gradient(circle,rgba(242,85,44,0.32)_0%,rgba(242,85,44,0.08)_48%,transparent_70%)]",
          !searching && "animate-breathe",
        )}
      />
      {searching &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute size-[clamp(196px,58vw,248px)] rounded-full border-2 border-coral/60"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={reduce ? { opacity: [0.6, 0.2, 0.6] } : { scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: reduce ? 1.2 : 1.6, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      <motion.button
        type="button"
        onClick={onPress}
        disabled={searching}
        aria-label={searching ? "Finding someone" : label}
        aria-busy={searching || undefined}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        whileHover={reduce || searching ? undefined : { scale: 1.015 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn(
          "group relative isolate flex size-[clamp(196px,58vw,248px)] items-center justify-center rounded-full outline-none",
          "focus-visible:ring-4 focus-visible:ring-cobalt/40",
          searching && "cursor-default",
        )}
      >
        {/* The tail that turns the circle into a speech bubble. It sits under the disc, so only the tip shows. */}
        <span aria-hidden="true" className="absolute bottom-[3%] left-[8%] z-0 size-[18%] rotate-45 rounded-[16%] bg-[#cf3d1b]" />
        <span
          aria-hidden="true"
          className="absolute inset-0 z-10 rounded-full bg-[radial-gradient(115%_115%_at_32%_22%,#ff8a66_0%,#f2552c_48%,#c93a18_100%)] shadow-orb"
        />
        <span aria-hidden="true" className="absolute inset-[7px] z-10 rounded-full border border-white/25" />
        <motion.span
          className="relative z-20 text-[15px] font-semibold uppercase tracking-[0.24em] text-white drop-shadow-[0_1px_1px_rgba(120,30,10,0.35)]"
          animate={{ opacity: searching ? 0 : 1, scale: searching ? 0.9 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.span>
        {searching && (
          <motion.span
            aria-hidden="true"
            className="absolute z-20 size-3 rounded-full bg-white"
            animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>
    </div>
  );
}
