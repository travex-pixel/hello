"use client";

import { CHARACTERS } from "@/lib/characters";
import { PERSONAS } from "@/lib/ai/personas";
import { useHello } from "@/lib/conversation/store";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";

/** Pick a character directly instead of being matched. One line each on how they text. */
export function CharacterPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const blocked = useHello((s) => s.blockedCharacterIds);
  const list = CHARACTERS.filter((c) => !blocked.includes(c.id));
  return (
    <Sheet open={open} onClose={onClose} title="Choose who to talk to">
      <p className="-mt-1 mb-3 text-sm text-ink-3">All AI characters, each with their own way of texting.</p>
      <ul className="-mx-2 max-h-[60vh] overflow-y-auto overscroll-contain">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.03]"
            >
              <Avatar name={c.name} hue={c.hue} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-ink">{c.name}</span>
                <span className="block truncate text-sm text-ink-3">{PERSONAS[c.id].tagline}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
