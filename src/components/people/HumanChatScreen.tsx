"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreHorizontal, UserRound } from "lucide-react";
import { MODE_COPY } from "@/lib/matching";
import type { Mode } from "@/lib/characters/types";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Composer, type ComposerHandle } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Starters } from "@/components/chat/Starters";
import { peopleApi, PeopleApiError, type ConversationView } from "./api";

const STARTERS: Record<Mode, string[]> = {
  bored: ["Hey! What's the best thing you've eaten this week?", "Hello. Give me a hot take on anything.", "Hi, I'm bored too. Rescue me?"],
  warmup: ["Hi! Nice to meet you.", "Hey, how's your day going?", "Hello, first time doing this. You?"],
  surprise: ["Hi! What's something you're weirdly into?", "Hello. What's a question nobody asks you?", "Hey, tell me something unexpected about your week."],
};

export function HumanChatScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [view, setView] = useState<ConversationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [startersOverride, setStartersOverride] = useState<boolean | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTs = useRef(0);

  const load = useCallback(async () => {
    try {
      const v = await peopleApi.conversation(conversationId, lastTs.current);
      setView((prev) => {
        const messages = prev ? [...prev.messages, ...v.messages.filter((m) => !prev.messages.some((p) => p.id === m.id))] : v.messages;
        return { ...v, messages };
      });
      for (const m of v.messages) lastTs.current = Math.max(lastTs.current, m.ts);
    } catch (e) {
      setError(e instanceof PeopleApiError && e.status === 404 ? "This conversation isn't available." : "Connection problem.");
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 2000);
    return () => window.clearInterval(t);
  }, [load]);

  const mine = view?.messages.filter((m) => m.mine).length ?? 0;
  const startersOpen = startersOverride ?? mine === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [view?.messages.length]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-ink-2">{error}</p>
        <Button variant="secondary" onClick={() => router.push("/people")}>
          Back to Real people
        </Button>
      </div>
    );
  }
  if (!view) return <div className="flex flex-1 items-center justify-center text-sm text-ink-3">Opening…</div>;

  const ended = !!view.endedAt;

  const send = async (text: string) => {
    try {
      await peopleApi.sendMessage(conversationId, text);
      await load();
    } catch (e) {
      setError(e instanceof PeopleApiError && e.code === "ended" ? "This conversation has ended." : "Couldn't send that message.");
    }
  };

  return (
    <div className="fixed inset-0 z-20 mx-auto flex w-full max-w-md flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-bg/90 px-2 pb-2 pt-[calc(var(--safe-top)+8px)] backdrop-blur-md">
        <IconButton label="Back" onClick={() => router.push("/people")}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-ink">{view.other.displayName}</h1>
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">Real person</span>
          </div>
          <p className="truncate text-xs text-ink-3">
            {MODE_COPY[view.mode].label} · Local test mode{ended ? " · Ended" : ""}
          </p>
        </div>
        <IconButton label="Conversation options" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4" role="log" aria-live="polite">
        <div className="flex flex-col gap-2.5">
          <p className="mx-auto max-w-[85%] px-2 py-1 text-center text-xs leading-relaxed text-ink-3">
            You both accepted this conversation. Be kind. You can leave, block or report at any time.
          </p>
          {view.messages.map((m) => (
            <MessageBubble key={m.id} message={{ id: m.id, role: m.mine ? "user" : "character", text: m.text, ts: m.ts }} />
          ))}
          {ended && <p className="mx-auto mt-2 text-center text-xs text-ink-3">Conversation ended{view.endedByMe ? " by you" : ` by ${view.other.displayName}`}.</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {ended ? (
        <div className="flex flex-col gap-2 border-t border-line px-3 pb-[calc(12px+var(--safe-bottom))] pt-3">
          <Button size="lg" block onClick={() => router.push("/people")}>
            Back to Real people
          </Button>
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {startersOpen && (
              <Starters
                starters={STARTERS[view.mode]}
                hint="Not sure how to start? Tap one, or type anything."
                onPick={(s) => {
                  composerRef.current?.setText(s);
                  setStartersOverride(false);
                }}
              />
            )}
          </AnimatePresence>
          <Composer ref={composerRef} onSend={(t) => void send(t)} onToggleStarters={() => setStartersOverride(!startersOpen)} startersOpen={startersOpen} placeholder={`Message ${view.other.displayName}`} />
        </>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Conversation">
        <div className="flex flex-col gap-2">
          {!ended && (
            <Button
              variant="secondary"
              block
              onClick={() => {
                setMenuOpen(false);
                void peopleApi.endConversation(conversationId).then(load);
              }}
            >
              End conversation
            </Button>
          )}
          <Button
            variant="secondary"
            block
            onClick={() => {
              setMenuOpen(false);
              void peopleApi.block(view.other.id).then(() => router.push("/people"));
            }}
          >
            Block {view.other.displayName}
          </Button>
          <Button
            variant="danger"
            block
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            Report
          </Button>
          <p className="mt-1 text-center text-xs text-ink-3">Blocking ends this conversation and removes the connection between you. Reports are stored for review.</p>
        </div>
      </Sheet>

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report this person">
        <div className="flex flex-col gap-2">
          {["Harassment or abuse", "Felt unsafe", "Spam or scam", "Something else"].map((reason) => (
            <Button
              key={reason}
              variant="secondary"
              block
              onClick={() => {
                setReportOpen(false);
                void peopleApi.report(view.other.id, reason, conversationId).then(() => peopleApi.block(view.other.id)).then(() => router.push("/people"));
              }}
            >
              {reason}
            </Button>
          ))}
          <p className="text-xs text-ink-3">Reporting also blocks them and ends the conversation.</p>
        </div>
      </Sheet>
    </div>
  );
}
