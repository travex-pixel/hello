"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { useHello } from "@/lib/conversation/store";
import { MODE_COPY } from "@/lib/matching";
import { track } from "@/lib/analytics/track";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Wordmark";
import { ConnectButton } from "./ConnectButton";
import { MatchCard } from "./MatchCard";
import { CharacterPicker } from "./CharacterPicker";
import { ModeSelector } from "./ModeSelector";
import { useDiscovery } from "./useDiscovery";
import { MatePanel } from "./MatePanel";
import { useMateMatch } from "./useMateMatch";
import { peopleApi, type StatusView } from "@/components/people/api";

/** A small live dot. Only ever placed next to a statement that is true from real data. */
function StatusDot({ className = "bg-mint-ink" }: { className?: string }) {
  return <span className={`size-2 shrink-0 rounded-full animate-pulse-dot ${className}`} aria-hidden="true" />;
}

export function DiscoverScreen() {
  const reduce = useReducedMotion();
  const mode = useHello((s) => s.mode);
  const setMode = useHello((s) => s.setMode);
  const blocked = useHello((s) => s.blockedCharacterIds);
  const unblock = useHello((s) => s.unblockCharacter);
  const { state, error, start, tryAnother, accept, startWith, reset } = useDiscovery();
  const [picking, setPicking] = useState(false);
  const router = useRouter();
  const mate = useMateMatch(mode);
  const [people, setPeople] = useState<StatusView | null>(null);
  const humans = !!people?.enabled;
  const lookingForMate = mate.view.phase === "looking";
  const mateBusy = mate.view.phase === "looking" && !mate.view.timedOut && mate.view.match?.state !== "incoming";
  const searching = state.status === "searching" || mateBusy;
  const copy = MODE_COPY[mode];

  useEffect(() => {
    track("landing_viewed");
    let cancelled = false;
    const load = () =>
      peopleApi.status().then(
        (s) => !cancelled && setPeople(s),
        () => undefined,
      );
    void load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, []);

  // Someone accepted (or we accepted): go straight into the real conversation.
  useEffect(() => {
    if (mate.view.phase === "connected") router.push(`/people/chat/${mate.view.conversationId}`);
  }, [mate.view, router]);

  /** Primary action. With real-people mode on it looks for a mate; otherwise it's the AI demo. */
  const onPrimary = () => {
    if (searching) return;
    if (!humans) return void start();
    if (!people?.joined) return router.push("/people");
    track("discovery_tapped", { mode, source: "human" });
    mate.start();
  };

  const chooseAI = () => {
    mate.stop();
    void start();
  };

  const fade = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  };

  const mateCount = (people?.joined && people.availableNow) || 0;

  return (
    <div className="flex flex-1 flex-col px-5 pt-[calc(var(--safe-top)+12px)]">
      <header className="flex items-center justify-between">
        <Wordmark size="sm" />
        <Link href="/profile" aria-label="Profile and settings" className="-mr-2 rounded-full">
          <IconButton label="Profile and settings" tone="subtle" tabIndex={-1} className="pointer-events-none">
            <Settings2 className="size-5" />
          </IconButton>
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-5 text-center short:py-3 sm:py-4">
        <AnimatePresence mode="wait" initial={false}>
          {(state.status === "idle" || state.status === "searching") && (
            <motion.div key="hero" {...fade} className="flex w-full flex-col items-center">
              <h1 className="display text-balance text-[clamp(32px,9.4vw,46px)] leading-[1.02] text-ink short:text-[30px]">
                Meet someone interesting<span className="text-accent">.</span>
              </h1>
              <p className="mt-2.5 text-balance text-[16px] leading-snug text-ink-3 short:hidden">A good conversation can start with anyone.</p>

              <div className="mt-7 w-full max-w-[400px] short:mt-5">
                <ModeSelector value={mode} onChange={setMode} disabled={searching || lookingForMate} />
              </div>

              {lookingForMate && mate.view.phase === "looking" && (mate.view.timedOut || mate.view.match?.state === "incoming") ? (
                <div className="mt-6 w-full">
                  <MatePanel view={mate.view} onStop={mate.stop} onKeepLooking={mate.keepLooking} onChooseAI={chooseAI} onRespond={(id, action) => void mate.respond(id, action)} />
                </div>
              ) : (
                <div className="my-11 short:my-6 sm:my-12">
                  <ConnectButton searching={searching} onPress={onPrimary} busyLabel={mateBusy ? "Looking for a mate" : "Finding someone"} />
                </div>
              )}

              <div className="min-h-[44px] w-full short:min-h-[36px]" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {error && !searching ? (
                    <motion.p key="error" {...fade} role="status" className="mx-auto max-w-[34ch] text-sm font-medium text-warning">
                      {error}
                    </motion.p>
                  ) : lookingForMate && mate.view.phase === "looking" ? (
                    !mate.view.timedOut && mate.view.match?.state !== "incoming" ? (
                      <motion.div key="mate" {...fade}>
                        <MatePanel view={mate.view} onStop={mate.stop} onKeepLooking={mate.keepLooking} onChooseAI={chooseAI} onRespond={(id, action) => void mate.respond(id, action)} />
                      </motion.div>
                    ) : null
                  ) : humans && !searching ? (
                    <motion.div key="human-blurb" {...fade} className="flex flex-col items-center">
                      <p className="text-[15px] font-medium text-ink">
                        {!people?.joined
                          ? "Sign in to meet your mates."
                          : mateCount
                            ? `${mateCount} ${mateCount === 1 ? "mate" : "mates"} free now.`
                            : "No mates free yet. Tap to be visible."}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-1" onClick={() => void start()}>
                        Try an AI character
                      </Button>
                    </motion.div>
                  ) : searching ? (
                    <motion.div key="finding" {...fade}>
                      <p className="text-[15px] font-medium text-accent">{copy.finding}…</p>
                    </motion.div>
                  ) : (
                    <motion.div key="blurb" {...fade}>
                      <p className="text-[15px] font-medium text-ink-2">{copy.blurb}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {(state.status === "found" || state.status === "connecting") && (
            <motion.div key="match" {...fade} className="w-full">
              <MatchCard match={state.match} connecting={state.status === "connecting"} error={error} onAccept={() => void accept()} onDecline={tryAnother} onChoose={() => setPicking(true)} />
            </motion.div>
          )}

          {state.status === "empty" && (
            <motion.div key="empty" {...fade} className="w-full rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-6 shadow-card">
              <h2 className="display text-[26px] text-ink">No one to meet right now</h2>
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

      <CharacterPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          setPicking(false);
          void startWith(id);
        }}
      />

      <footer className="pb-3 text-center text-[13px] text-ink-3 short:hidden">
        <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <StatusDot />
          {mateCount > 0 ? (
            <span className="text-mint-ink">
              {mateCount} {mateCount === 1 ? "mate" : "mates"} free
            </span>
          ) : (
            <span>AI characters, clearly labelled</span>
          )}
          <span aria-hidden="true">·</span>
          <Link href={humans && people?.joined ? "/people" : "/how-it-works"} className="inline-flex min-h-[32px] items-center text-ink-2 underline-offset-4 hover:underline">
            {humans && people?.joined ? "Mates" : "How it works"}
          </Link>
        </p>
      </footer>
    </div>
  );
}
