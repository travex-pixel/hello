"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { useHello } from "@/lib/conversation/store";
import { MODE_COPY } from "@/lib/matching";
import { track } from "@/lib/analytics/track";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "./ConnectButton";
import { MatchCard } from "./MatchCard";
import { ModeSelector } from "./ModeSelector";
import { useDiscovery } from "./useDiscovery";

export function DiscoverScreen() {
  const reduce = useReducedMotion();
  const mode = useHello((s) => s.mode);
  const setMode = useHello((s) => s.setMode);
  const blocked = useHello((s) => s.blockedCharacterIds);
  const unblock = useHello((s) => s.unblockCharacter);
  const { state, start, tryAnother, accept, reset } = useDiscovery();
  const searching = state.status === "searching";
  const copy = MODE_COPY[mode];

  useEffect(() => {
    track("landing_viewed");
  }, []);

  const fade = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="flex flex-1 flex-col px-5 pt-[calc(var(--safe-top)+14px)]">
      <header className="flex items-center justify-between">
        <span className="text-[15px] font-bold tracking-[0.28em] text-ink">HELLO</span>
        <Link href="/profile" aria-label="Profile and settings" className="-mr-2">
          <IconButton label="Profile and settings" tabIndex={-1} className="pointer-events-none">
            <Settings2 className="size-5" />
          </IconButton>
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-4 text-center sm:py-6">
        <AnimatePresence mode="wait" initial={false}>
          {(state.status === "idle" || state.status === "searching") && (
            <motion.div key="hero" {...fade} className="flex w-full flex-col items-center">
              <h1 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[34px]">
                Meet someone interesting. In one tap.
              </h1>
              <p className="mt-3 text-[15px] text-ink-2">You don&rsquo;t need a reason to say hello.</p>

              <div className="mt-7 w-full max-w-[380px]">
                <ModeSelector value={mode} onChange={setMode} disabled={searching} />
              </div>

              <div className="my-9">
                <ConnectButton searching={searching} onPress={() => void start()} />
              </div>

              <div className="min-h-[52px]" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {searching ? (
                    <motion.div key="finding" {...fade}>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-strong">{copy.finding}</p>
                      <p className="mt-1.5 text-sm text-ink-2">Looking for an interesting conversation.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="blurb" {...fade}>
                      <p className="text-[15px] text-ink">{copy.blurb}</p>
                      <p className="mt-1.5 text-sm text-ink-3">There&rsquo;s always a new conversation to discover.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {(state.status === "found" || state.status === "connecting") && (
            <motion.div key="match" {...fade} className="w-full">
              <p className="mb-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-accent-strong">Someone to meet</p>
              <MatchCard match={state.match} connecting={state.status === "connecting"} onAccept={() => void accept()} onDecline={tryAnother} />
            </motion.div>
          )}

          {state.status === "empty" && (
            <motion.div key="empty" {...fade} className="w-full rounded-xl border border-line bg-surface p-6">
              <h2 className="text-xl font-semibold tracking-tight text-ink">No one to meet right now</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {blocked.length > 0
                  ? "Every available AI character is blocked. Unblock someone to keep going."
                  : "The demo characters are all unavailable for this mode. Try another mode."}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {blocked.length > 0 && (
                  <Button variant="secondary" block onClick={() => blocked.forEach(unblock)}>
                    Unblock everyone
                  </Button>
                )}
                <Button variant="ghost" block onClick={reset}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer className="pb-4 text-center text-xs text-ink-3">
        <p className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          AI demo partners available
          <span aria-hidden="true">·</span>
          <Link href="/how-it-works" className="text-ink-2 underline-offset-4 hover:underline">
            How it works
          </Link>
        </p>
        <p className="mt-1.5">
          Real people are invite-only.{" "}
          <Link href="/people" className="text-ink-2 underline-offset-4 hover:underline">
            See how that works
          </Link>
        </p>
      </footer>
    </div>
  );
}
