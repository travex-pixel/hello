"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { peopleApi, type MeView } from "@/components/people/api";
import { getCharacter } from "@/lib/characters";
import { useHello } from "@/lib/conversation/store";
import { MODE_COPY } from "@/lib/matching";
import { formatRelative } from "@/lib/utils/time";
import { Avatar } from "@/components/ui/Avatar";
import { AILabel } from "@/components/ui/AILabel";
import { Button } from "@/components/ui/Button";

export function ChatsList() {
  const router = useRouter();
  const hydrated = useHello((s) => s.hydrated);
  const order = useHello((s) => s.order);
  const conversations = useHello((s) => s.conversations);

  const items = order.map((id) => conversations[id]).filter(Boolean);
  const [mates, setMates] = useState<MeView["conversations"]>([]);

  // Real conversations live on the server, so they're here on any device you sign in on.
  useEffect(() => {
    let cancelled = false;
    peopleApi
      .status()
      .then((s) => (s.joined ? peopleApi.me() : null))
      .then((me) => !cancelled && me && setMates(me.conversations))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col px-5 pt-[calc(var(--safe-top)+14px)]">
      <h1 className="display text-[34px] text-ink">Chats</h1>

      {mates.length > 0 && (
        <section className="mt-5" aria-label="Chats with mates">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-3">Mates</h2>
          <ul className="-mx-2 mt-1 flex flex-col">
            {mates.map((c) => (
              <li key={c.id}>
                <Link href={`/people/chat/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2 active:bg-surface-3">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-mint text-mint-ink">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{c.withName}</span>
                      <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-mint-ink">Real person</span>
                      <span className="ml-auto shrink-0 text-xs text-ink-3">{formatRelative(c.startedAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {MODE_COPY[c.mode].label}
                      {c.endedAt ? " · Ended" : " · Open"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className={mates.length > 0 ? "mt-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-3" : "sr-only"}>AI characters</h2>
      <p className="mt-1 text-sm text-ink-3">AI chats are stored on this device only.</p>

      {!hydrated ? null : items.length === 0 ? (
        <div className="mt-10 flex flex-1 flex-col items-center justify-start text-center">
          <div className="w-full rounded-xl bg-surface p-6 shadow-card">
            <h2 className="display text-[26px] text-ink">No conversations yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">Tap the button on Discover and someone will be here within seconds.</p>
            <Button className="mt-4" block onClick={() => router.push("/")}>
              Find someone to talk to
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-5 -mx-2 flex flex-col">
          {items.map((c) => {
            const character = getCharacter(c.characterId);
            if (!character) return null;
            const last = [...c.messages].reverse().find((m) => m.role !== "system");
            return (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2 active:bg-surface-3"
                >
                  <Avatar name={character.name} hue={character.hue} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-ink">{character.name}</span>
                      <AILabel />
                      <span className="ml-auto shrink-0 text-xs text-ink-3">{formatRelative(last?.ts ?? c.startedAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-2">
                      {last ? (last.role === "user" ? "You: " : "") + last.text : "New conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {MODE_COPY[c.mode].label}
                      {c.endedAt ? " · Ended" : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
