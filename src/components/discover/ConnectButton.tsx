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

/**
 * The one thing to tap. A glass sphere lit from inside, with hairline
 * contour rings and a slow sheen around it. Pressed: an immediate squash.
 * Searching: the button is disabled (a second tap can't start a second
 * request) and the contours ripple outward until a match is ready.
 */
export function ConnectButton({ searching, onPress, label = "Start a conversation", busyLabel = "Finding someone" }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-center justify-center">
      {/* Light behind the sphere. */}
      <div aria-hidden="true" className="absolute size-[calc(var(--orb)*1.7)] rounded-full bg-[radial-gradient(circle,rgba(106,98,239,0.38)_0%,rgba(106,98,239,0.1)_42%,transparent_68%)]" />

      {/* Contours: still hairlines while idle, ripples while searching. */}
      {!searching &&
        [1.22, 1.46].map((k) => (
          <span key={k} aria-hidden="true" className="absolute rounded-full border border-white/[0.07]" style={{ width: `calc(var(--orb) * ${k})`, height: `calc(var(--orb) * ${k})` }} />
        ))}
      {searching &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute size-[var(--orb)] rounded-full border border-accent/50"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={reduce ? { opacity: [0.6, 0.2, 0.6] } : { scale: [1, 1.7], opacity: [0.7, 0] }}
            transition={{ duration: reduce ? 1.2 : 1.8, delay: i * 0.45, repeat: Infinity, ease: "easeOut" }}
          />
        ))}

      {/* A slow sheen travelling around the rim. */}
      <span
        aria-hidden="true"
        className="absolute size-[calc(var(--orb)+14px)] animate-sheen rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(190,186,255,0.55)_40deg,transparent_110deg,transparent_360deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-1.5px),#000_calc(100%-1px))]"
      />

      <motion.button
        type="button"
        onClick={onPress}
        disabled={searching}
        aria-label={searching ? busyLabel : label}
        aria-busy={searching || undefined}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        whileHover={reduce || searching ? undefined : { scale: 1.02 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn("orb-button group relative isolate flex size-[var(--orb)] items-center justify-center rounded-full", searching && "cursor-default")}
      >
        {/* Body: lit from the upper left, deep at the base. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[radial-gradient(120%_120%_at_30%_20%,#c9c5ff_0%,#8a80fa_26%,#5b52e4_55%,#3a2fb6_80%,#241c7a_100%)] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),inset_0_-24px_40px_rgba(16,8,70,0.55),0_0_0_1px_rgba(255,255,255,0.12),0_36px_80px_-24px_rgba(94,84,240,0.8),0_12px_24px_-8px_rgba(0,0,0,0.6)] transition-[filter] duration-200 group-hover:brightness-110 group-active:brightness-95"
        />
        {/* Specular highlight. */}
        <span aria-hidden="true" className="absolute left-[20%] top-[6%] h-[24%] w-[52%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.5),rgba(255,255,255,0))] blur-[2px]" />
        <motion.span
          aria-hidden="true"
          className="relative z-10 flex max-w-[76%] flex-col items-center gap-3 text-balance text-[clamp(16px,4.4vw,19px)] font-semibold leading-tight tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(20,10,80,0.5)]"
          animate={{ opacity: searching ? 0 : 1, scale: searching ? 0.92 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {label}
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-sm">
            <ArrowRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.5} />
          </span>
        </motion.span>
        {searching && (
          <span aria-hidden="true" className="absolute z-10 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-white animate-typing-dot" style={{ animationDelay: `${i * 0.16}s` }} />
            ))}
          </span>
        )}
      </motion.button>
    </div>
  );
}
