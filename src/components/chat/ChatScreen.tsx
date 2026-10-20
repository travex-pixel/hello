"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { getCharacter } from "@/lib/characters";
import { useHello } from "@/lib/conversation/store";
import { MODE_COPY } from "@/lib/matching";
import { formatTime } from "@/lib/utils/time";
import { Avatar } from "@/components/ui/Avatar";
import { AILabel } from "@/components/ui/AILabel";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Composer, type ComposerHandle } from "./Composer";
import { EndSheet } from "./EndSheet";
import { MessageBubble } from "./MessageBubble";
import { Starters } from "./Starters";
import { TypingIndicator } from "./TypingIndicator";

const TIME_GAP_MS = 5 * 60 * 1000;

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const hydrated = useHello((s) => s.hydrated);
  const conversation = useHello((s) => s.conversations[conversationId]);
  const typing = useHello((s) => s.typing[conversationId] ?? false);
  const sendMessage = useHello((s) => s.sendMessage);
  const retryMessage = useHello((s) => s.retryMessage);
  const endConversation = useHello((s) => s.endConversation);
  const blockCharacter = useHello((s) => s.blockCharacter);
  const reportConversation = useHello((s) => s.reportConversation);
  const deleteConversation = useHello((s) => s.deleteConversation);
  const setAutoStart = useHello((s) => s.setAutoStart);

  const [menuOpen, setMenuOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [startersOverride, setStartersOverride] = useState<boolean | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const character = conversation ? getCharacter(conversation.characterId) : undefined;
  const messageCount = conversation?.messages.length ?? 0;
  const userMessages = conversation?.messages.filter((m) => m.role === "user").length ?? 0;

  // Starters show until the first message, unless the user toggles them.
  const startersOpen = startersOverride ?? userMessages === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, typing]);

  if (!hydrated) {
    return <div className="flex flex-1 items-center justify-center text-sm text-ink-3">Opening chat…</div>;
  }

  if (!conversation || !character) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">This chat isn&rsquo;t here</h1>
        <p className="text-sm text-ink-2">It may have been cleared from this device.</p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Back to Discover
        </Button>
      </div>
    );
  }

  const ended = !!conversation.endedAt;
  const modeLabel = MODE_COPY[conversation.mode].label;
  const starters = character.starters[conversation.mode];

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/chats");
  };

  const meetSomeoneElse = () => {
    setMenuOpen(false);
    if (!ended) endConversation(conversationId);
    setAutoStart(true);
    router.push("/");
  };

  const endNow = () => {
    setMenuOpen(false);
    endConversation(conversationId);
    setEndOpen(true);
  };

  // Show a timestamp when more than five minutes passed since the previous message.
  const rows: { message: (typeof conversation.messages)[number]; showTime: boolean }[] = [];
  let lastTs = 0;
  for (const m of conversation.messages) {
    const showTime = m.role !== "system" && m.ts - lastTs > TIME_GAP_MS;
    if (m.role !== "system") lastTs = m.ts;
    rows.push({ message: m, showTime });
  }

  return (
    <div className="fixed inset-0 z-20 mx-auto flex w-full max-w-md flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-bg/90 px-2 pb-2 pt-[calc(var(--safe-top)+8px)] backdrop-blur-md">
        <IconButton label="Back" onClick={goBack}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <Avatar name={character.name} hue={character.hue} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-ink">{character.name}</h1>
            <AILabel />
          </div>
          <p className="truncate text-xs text-ink-3">
            {modeLabel} · AI demo{ended ? " · Ended" : ""}
          </p>
        </div>
        <IconButton label="Conversation options" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4" role="log" aria-live="polite" aria-label={`Conversation with ${character.name}`}>
        <div className="flex flex-col gap-2.5">
          {rows.map(({ message: m, showTime }) => (
            <div key={m.id} className="flex flex-col gap-2.5">
              {showTime && <p className="py-1 text-center text-[11px] text-ink-3">{formatTime(m.ts)}</p>}
              <MessageBubble message={m} onRetry={() => void retryMessage(conversationId, m.id)} />
            </div>
          ))}
          {typing && <TypingIndicator name={character.name} />}
          {ended && (
            <p className="mx-auto mt-2 max-w-[85%] text-center text-xs text-ink-3">
              Conversation ended. {conversation.feedback ? "Thanks for the feedback." : ""}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {ended && endOpen ? null : ended ? (
        <div className="flex flex-col gap-2 border-t border-line px-3 pb-[calc(12px+var(--safe-bottom))] pt-3">
          <Button size="lg" block onClick={meetSomeoneElse}>
            Meet someone else
          </Button>
          <Button variant="ghost" block onClick={() => router.push("/")}>
            Back to Discover
          </Button>
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {startersOpen && (
              <Starters
                starters={starters}
                hint={userMessages === 0 ? "Not sure what to say? Tap one, or type anything." : undefined}
                onPick={(s) => {
                  composerRef.current?.setText(s);
                  setStartersOverride(false);
                }}
              />
            )}
          </AnimatePresence>
          <Composer
            ref={composerRef}
            onSend={(t) => void sendMessage(conversationId, t)}
            onToggleStarters={() => setStartersOverride(!startersOpen)}
            startersOpen={startersOpen}
            placeholder={`Message ${character.name}`}
          />
        </>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Conversation">
        <div className="flex flex-col gap-2">
          {!ended && (
            <Button variant="secondary" block onClick={endNow}>
              End conversation
            </Button>
          )}
          <Button variant="secondary" block onClick={meetSomeoneElse}>
            Meet someone else
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              blockCharacter(character.id);
              endConversation(conversationId);
              setMenuOpen(false);
              router.push("/");
            }}
          >
            Block {character.name}
          </Button>
          <Button
            variant="danger"
            block
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            Report this conversation
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() => {
              deleteConversation(conversationId);
              setMenuOpen(false);
              router.push("/chats");
            }}
          >
            Delete this chat
          </Button>
          <p className="mt-1 text-center text-xs text-ink-3">
            Blocking hides {character.name} from future matches. Reports are stored on this device in the demo.{" "}
            <Link href="/how-it-works" className="underline-offset-2 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
      </Sheet>

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report this conversation">
        <p className="mb-3 text-sm text-ink-2">Tell us what went wrong. The conversation will end.</p>
        <div className="flex flex-col gap-2">
          {["Inappropriate or offensive", "Felt unsafe or uncomfortable", "Pretended to be a real person", "Something else"].map((reason) => (
            <Button
              key={reason}
              variant="secondary"
              block
              onClick={() => {
                reportConversation(conversationId, reason);
                setReportOpen(false);
                setEndOpen(true);
              }}
            >
              {reason}
            </Button>
          ))}
        </div>
      </Sheet>

      <EndSheet open={endOpen} conversationId={conversationId} characterName={character.name} onClose={() => setEndOpen(false)} />
    </div>
  );
}
