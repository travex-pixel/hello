"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useHello } from "@/lib/conversation/store";
import { useModelStatus } from "@/lib/ai/useModelStatus";
import { MemoryCard } from "./MemoryCard";
import { StyleCard } from "./StyleCard";
import { PICKABLE_TOPICS, TOPIC_LABELS, type TopicId } from "@/lib/characters/topics";
import { getCharacter } from "@/lib/characters";
import type { DepthPreference, VibePreference } from "@/lib/matching";
import { clearEvents } from "@/lib/analytics/track";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils/cn";

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div role="radiogroup" aria-label={label} className={cn("grid gap-1 rounded-[22px] bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]", options.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 min-w-0 truncate rounded-full px-2 text-sm font-semibold transition-all",
              o.value === value ? "bg-[linear-gradient(180deg,#2c3040,#22263a)] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.45)]" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[26px] bg-[linear-gradient(180deg,#171a24,#12141c)] p-5 shadow-card", className)}>
      <h2 className="display text-[22px] text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ProfileScreen() {
  const hydrated = useHello((s) => s.hydrated);
  const preferences = useHello((s) => s.preferences);
  const setPreferences = useHello((s) => s.setPreferences);
  const blocked = useHello((s) => s.blockedCharacterIds);
  const unblock = useHello((s) => s.unblockCharacter);
  const clearHistory = useHello((s) => s.clearHistory);
  const conversationCount = useHello((s) => s.order.length);
  const [confirmClear, setConfirmClear] = useState(false);
  const engine = useModelStatus();

  const toggleTopic = (t: TopicId) => {
    const topics = preferences.topics.includes(t) ? preferences.topics.filter((x) => x !== t) : [...preferences.topics, t];
    setPreferences({ topics });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-[calc(var(--safe-top)+14px)]">
      <div>
        <h1 className="display text-[34px] text-ink">Profile</h1>
        <p className="mt-1 text-sm text-ink-3">Everything here is optional and stays on this device.</p>
      </div>

      {hydrated && (
        <>
          <Card title="About you">
            <div>
              <label htmlFor="displayName" className="mb-2 block text-sm font-medium text-ink">
                What should people call you?
              </label>
              <input
                id="displayName"
                type="text"
                maxLength={30}
                autoComplete="given-name"
                value={preferences.displayName ?? ""}
                onChange={(e) => setPreferences({ displayName: e.target.value.trim() ? e.target.value : undefined })}
                placeholder="First name or nickname"
                className="h-[52px] w-full rounded-2xl border border-line bg-black/30 px-4 text-[16px] text-ink shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] placeholder:text-ink-3"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">What do you enjoy talking about?</p>
              <div className="flex flex-wrap gap-2">
                {PICKABLE_TOPICS.map((t) => (
                  <Chip key={t} selected={preferences.topics.includes(t)} onClick={() => toggleTopic(t)}>
                    {TOPIC_LABELS[t]}
                  </Chip>
                ))}
              </div>
              
            </div>
            <Segmented<DepthPreference>
              label="Quick hello or a deeper conversation?"
              value={preferences.depth}
              onChange={(depth) => setPreferences({ depth })}
              options={[
                { value: "quick", label: "Quick" },
                { value: "either", label: "Either" },
                { value: "deeper", label: "Deeper" },
              ]}
            />
            <Segmented<VibePreference>
              label="Who do you get on with?"
              value={preferences.vibe}
              onChange={(vibe) => setPreferences({ vibe })}
              options={[
                { value: "any", label: "Anyone" },
                { value: "funny", label: "Funny" },
                { value: "thoughtful", label: "Thoughtful" },
                { value: "outgoing", label: "Outgoing" },
              ]}
            />
          </Card>

          <StyleCard Card={Card} />

          <MemoryCard Card={Card} />

          <Card title="Mates">
            <p className="text-sm text-ink-3">Real people, invite-only.</p>
            <Link href="/people" className="flex min-h-[52px] items-center justify-between rounded-2xl bg-white/[0.05] px-4 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.08]">
              Open Mates
              <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
            </Link>
          </Card>

          <Card title="Demo">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-3">Replies</dt>
              <dd className="text-ink">{engine === null ? "Checking…" : engine === "model" ? "Language model (Anthropic), via HELLO's server" : "Local engine, on your device"}</dd>
              <dt className="text-ink-3">Conversations</dt>
              <dd className="text-ink">{conversationCount}</dd>
            </dl>
            {blocked.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Blocked characters</p>
                <div className="flex flex-wrap gap-2">
                  {blocked.map((id) => (
                    <Chip key={id} selected onClick={() => unblock(id)} aria-label={`Unblock ${getCharacter(id)?.name ?? id}`}>
                      {getCharacter(id)?.name ?? id} · Unblock
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <Button variant="danger" block onClick={() => setConfirmClear(true)}>
              Clear demo history
            </Button>
            <Link href="/how-it-works" className="flex min-h-[52px] items-center justify-between rounded-2xl bg-white/[0.05] px-4 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.08]">
              How HELLO works
              <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
            </Link>
          </Card>
        </>
      )}

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear demo history?">
        <p className="text-sm text-ink-2">This deletes every conversation, report, saved memory and local usage event on this device. Your preferences stay.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="danger"
            block
            onClick={() => {
              clearHistory();
              clearEvents();
              setConfirmClear(false);
            }}
          >
            Clear everything
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmClear(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
