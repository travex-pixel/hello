"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreHorizontal, UserRound } from "lucide-react";
import { MODE_COPY } from "@/lib/matching";
import { track } from "@/lib/analytics/track";
import type { Mode } from "@/lib/characters/types";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Composer, type ComposerHandle } from "@/components/chat/Composer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Starters } from "@/components/chat/Starters";
import { newClientId, peopleApi, PeopleApiError, type ConversationView } from "./api";

const STARTERS: Record<Mode, string[]> = {
  bored: ["Hey! What's the best thing you've eaten this week?", "Hello. Give me a hot take on anything.", "Hi, I'm bored too. Rescue me?"],
  warmup: ["Hi! Nice to meet you.", "Hey, how's your day going?", "Hello, first time doing this. You?"],
  surprise: ["Hi! What's something you're weirdly into?", "Hello. What's a question nobody asks you?", "Hey, tell me something unexpected about your week."],
};

type ChatMessage = ConversationView["messages"][number];
interface Outgoing {
  clientId: string;
  text: string;
  ts: number;
  status: "sending" | "failed";
}

const POLL_ACTIVE_MS = 2500;
const POLL_IDLE_MS = 6000;

export function HumanChatScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [view, setView] = useState<Omit<ConversationView, "messages"> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [startersOverride, setStartersOverride] = useState<boolean | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(0);
  const lastActivity = useRef(0);
  const loaded = useRef(false);
  const hadReply = useRef(false);

  /** Fetches only messages after the last one we have; the server's sequence is the order of record. */
  const load = useCallback(async () => {
    try {
      const v = await peopleApi.conversation(conversationId, lastSeq.current);
      const { messages: fresh, ...meta } = v;
      setView(meta);
      setOffline(false);
      if (fresh.length) {
        lastActivity.current = Date.now();
        lastSeq.current = Math.max(lastSeq.current, ...fresh.map((m) => m.seq));
        // The first reply from the other person while this screen is open. No content is recorded.
        if (fresh.some((m) => !m.mine)) {
          if (loaded.current && !hadReply.current) track("first_response_received", { mode: v.mode, conversationId, source: "human" });
          hadReply.current = true;
        }
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !known.has(m.id))].sort((a, b) => a.seq - b.seq);
        });
        // A confirmed message replaces its pending copy.
        const confirmed = new Set(fresh.map((m) => m.clientId).filter(Boolean));
        setOutbox((o) => o.filter((x) => !confirmed.has(x.clientId)));
      }
      loaded.current = true;
    } catch (e) {
      if (e instanceof PeopleApiError && (e.status === 404 || e.status === 401 || e.status === 403)) {
        setFatal(e.status === 404 ? "This conversation isn't available." : "Please sign in again to see this conversation.");
      } else setOffline(true);
    }
  }, [conversationId]);

  /** Shown as "sending" until the server confirms; never shown as sent if it was rejected. */
  const deliver = useCallback(
    async (item: Outgoing) => {
      setOutbox((o) => [...o.filter((x) => x.clientId !== item.clientId), { ...item, status: "sending" }]);
      lastActivity.current = Date.now();
      try {
        await peopleApi.sendMessage(conversationId, item.text, item.clientId);
        await load();
      } catch (e) {
        if (e instanceof PeopleApiError && (e.code === "ended" || e.code === "blocked")) {
          setOutbox((o) => o.filter((x) => x.clientId !== item.clientId));
          await load();
          return;
        }
        setOutbox((o) => o.map((x) => (x.clientId === item.clientId ? { ...x, status: "failed" } : x)));
      }
    },
    [conversationId, load],
  );

  const send = useCallback((text: string) => void deliver({ clientId: newClientId(), text, ts: Date.now(), status: "sending" }), [deliver]);

  useEffect(() => {
    let timer: number;
    lastActivity.current = Date.now();
    const tick = async () => {
      if (document.visibilityState === "visible") await load();
      const idle = Date.now() - lastActivity.current > 60_000;
      timer = window.setTimeout(tick, idle ? POLL_IDLE_MS : POLL_ACTIVE_MS);
    };
    void tick();
    return () => window.clearTimeout(timer);
  }, [load]);

  const mine = messages.filter((m) => m.mine).length + outbox.length;
  const startersOpen = startersOverride ?? mine === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, outbox.length]);

  if (fatal) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-ink-2">{fatal}</p>
        <Button variant="secondary" onClick={() => router.push("/people")}>
          Back to Mates
        </Button>
      </div>
    );
  }
  if (!view) return <div className="flex flex-1 items-center justify-center text-sm text-ink-3">Opening…</div>;

  const ended = !!view.endedAt;


  return (
    <div className="fixed inset-0 z-20 mx-auto flex w-full max-w-md flex-col bg-bg">
      <header className="glass flex items-center gap-2 border-b border-line px-2 pb-2 pt-[calc(var(--safe-top)+8px)]">
        <IconButton label="Back" onClick={() => router.push("/people")}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-mint text-mint-ink">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-ink">{view.other.displayName}</h1>
            <span className="rounded-full border border-mint-ink/40 bg-mint px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mint-ink">Real person</span>
          </div>
          <p className="truncate text-xs text-ink-3">
            {MODE_COPY[view.mode].label} · Mates beta{ended ? " · Ended" : ""}
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
          {messages.map((m) => (
            <MessageBubble key={m.id} message={{ id: m.id, role: m.mine ? "user" : "character", text: m.text, ts: m.ts }} />
          ))}
          {outbox.map((o) => (
            <MessageBubble
              key={o.clientId}
              message={{ id: o.clientId, role: "user", text: o.text, ts: o.ts, status: o.status === "failed" ? "failed" : "sending" }}
              onRetry={() => void deliver(o)}
            />
          ))}
          {offline && (
            <p role="status" className="mx-auto text-center text-xs text-warning">
              Connection problem. Messages will appear when you&rsquo;re back online.
            </p>
          )}
          {ended && <p className="mx-auto mt-2 text-center text-xs text-ink-3">Conversation ended{view.endedByMe ? " by you" : ` by ${view.other.displayName}`}.</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {ended ? (
        <div className="flex flex-col gap-2 border-t border-line px-3 pb-[calc(12px+var(--safe-bottom))] pt-3">
          <Button size="lg" block onClick={() => router.push("/people")}>
            Back to Mates
          </Button>
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {startersOpen && (
              <Starters
                starters={STARTERS[view.mode]}
                hint="Tap one, or type anything."
                onPick={(s) => {
                  composerRef.current?.setText(s);
                  setStartersOverride(false);
                }}
              />
            )}
          </AnimatePresence>
          <Composer ref={composerRef} onSend={send} onToggleStarters={() => setStartersOverride(!startersOpen)} startersOpen={startersOpen} placeholder={`Message ${view.other.displayName}`} />
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
