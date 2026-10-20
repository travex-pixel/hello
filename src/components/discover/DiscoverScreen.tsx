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
import { ModeSelector } from "./ModeSelector";
import { useDiscovery } from "./useDiscovery";
import { MatePanel } from "./MatePanel";
import { useMateMatch } from "./useMateMatch";
import { peopleApi, type StatusView } from "@/components/people/api";

export function DiscoverScreen() {
  const reduce = useReducedMotion();
  const mode = useHello((s) => s.mode);
  const setMode = useHello((s) => s.setMode);
  const blocked = useHello((s) => s.blockedCharacterIds);
  const unblock = useHello((s) => s.unblockCharacter);
  const { state, start, tryAnother, accept, reset } = useDiscovery();
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

  return (
    <div className="flex flex-1 flex-col px-5 pt-[calc(var(--safe-top)+14px)]">
      <header className="flex items-center justify-between">
        <Wordmark />
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
              <h1 className="display text-[38px] leading-[1.02] text-ink sm:text-[48px]">
                Meet someone new.
                <br />
                <span className="text-accent">In one tap.</span>
              </h1>
              <p className="mt-4 text-[16px] text-ink-2">You don&rsquo;t need a reason to say hello.</p>

              <div className="mt-7 w-full max-w-[380px]">
                <ModeSelector value={mode} onChange={setMode} disabled={searching || lookingForMate} />
              </div>

              {lookingForMate && mate.view.phase === "looking" && (mate.view.timedOut || mate.view.match?.state === "incoming") ? (
                <div className="mt-7 w-full">
                  <MatePanel view={mate.view} onStop={mate.stop} onKeepLooking={mate.keepLooking} onChooseAI={chooseAI} onRespond={(id, action) => void mate.respond(id, action)} />
                </div>
              ) : (
                <div className="my-9">
                  <ConnectButton searching={searching} onPress={onPrimary} label={humans ? "Chat with a mate" : "Say hello"} />
                </div>
              )}

              <div className="min-h-[52px]" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {lookingForMate && mate.view.phase === "looking" ? (
                    !mate.view.timedOut && mate.view.match?.state !== "incoming" ? (
                      <motion.div key="mate" {...fade}>
                        <MatePanel view={mate.view} onStop={mate.stop} onKeepLooking={mate.keepLooking} onChooseAI={chooseAI} onRespond={(id, action) => void mate.respond(id, action)} />
                      </motion.div>
                    ) : null
                  ) : humans && !searching ? (
                    <motion.div key="human-blurb" {...fade} className="flex flex-col items-center">
                      <p className="text-[16px] font-medium text-ink">
                        {!people?.joined
                          ? "Real people from the invite-only beta."
                          : people.availableNow
                            ? `${people.availableNow} ${people.availableNow === 1 ? "mate is" : "mates are"} looking for a chat now.`
                            : "Real people from the beta. Nobody's looking right now."}
                      </p>
                      <Button variant="ghost" className="mt-1" onClick={() => void start()}>
                        Chat with AI instead
                      </Button>
                    </motion.div>
                  ) : searching ? (
                    <motion.div key="finding" {...fade}>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">{copy.finding}</p>
                      <p className="mt-1.5 text-sm text-ink-2">Looking for a good conversation.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="blurb" {...fade}>
                      <p className="text-[16px] font-medium text-ink">{copy.blurb}</p>
                      <p className="mt-1.5 text-sm text-ink-3">There&rsquo;s always a new conversation to discover.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {(state.status === "found" || state.status === "connecting") && (
            <motion.div key="match" {...fade} className="w-full">
              <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">Someone to meet</p>
              <MatchCard match={state.match} connecting={state.status === "connecting"} onAccept={() => void accept()} onDecline={tryAnother} />
            </motion.div>
          )}

          {state.status === "empty" && (
            <motion.div key="empty" {...fade} className="w-full rounded-xl bg-surface p-6 shadow-card">
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

      <footer className="pb-4 text-center text-xs text-ink-3">
        <p className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-mint-ink" aria-hidden="true" />
          AI demo partners available
          <span aria-hidden="true">·</span>
          <Link href="/how-it-works" className="text-ink-2 underline-offset-4 hover:underline">
            How it works
          </Link>
        </p>
        <p className="mt-1.5">
          {humans && people?.joined ? (
            <Link href="/people" className="text-ink-2 underline-offset-4 hover:underline">
              Your mates and invites
            </Link>
          ) : (
            <>
              Real people are invite-only.{" "}
              <Link href="/people" className="text-ink-2 underline-offset-4 hover:underline">
                {humans ? "Sign in or join" : "See how that works"}
              </Link>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
