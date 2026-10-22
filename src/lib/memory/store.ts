import type { MemoryKind, MemoryNote } from "./extract";

/** A durable note kept on this device and shown in Profile, where it can be edited or deleted. */
export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  text: string;
  createdAt: number;
  /** The conversation it came from, so a chat doesn't send its own notes twice. */
  conversationId?: string;
}

export const MAX_MEMORIES = 40;

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Adds new notes, skipping duplicates. A new name replaces the old one, a
 * new "likes X" replaces "doesn't like X" (and the reverse), and the oldest
 * notes fall off past the cap.
 */
export function mergeMemories(existing: MemoryItem[], notes: MemoryNote[], meta: { now: number; conversationId?: string; newId: () => string }): MemoryItem[] {
  let out = [...existing];
  for (const n of notes) {
    if (n.kind === "name") {
      out = out.filter((m) => m.kind !== "name");
      out.push({ id: meta.newId(), kind: "name", text: n.text, createdAt: meta.now, conversationId: meta.conversationId });
      continue;
    }
    const k = key(n.text);
    if (out.some((m) => key(m.text) === k)) continue;
    const subject = k.replace(/^(likes|doesnt like) /, "");
    if (n.kind === "like" || n.kind === "dislike") out = out.filter((m) => !((m.kind === "like" || m.kind === "dislike") && key(m.text).replace(/^(likes|doesnt like) /, "") === subject));
    out.push({ id: meta.newId(), kind: n.kind, text: n.text, createdAt: meta.now, conversationId: meta.conversationId });
  }
  if (out.length > MAX_MEMORIES) {
    const name = out.find((m) => m.kind === "name");
    const rest = out.filter((m) => m.kind !== "name").slice(-(MAX_MEMORIES - (name ? 1 : 0)));
    out = name ? [name, ...rest] : rest;
  }
  return out;
}

/** What goes to the model: the person's name and the notes from other chats, with their age in days. */
export function memoryContext(items: MemoryItem[], opts: { now: number; conversationId?: string; displayName?: string }) {
  const nameItem = items.find((m) => m.kind === "name");
  const name = opts.displayName?.trim() || nameItem?.text;
  const memories = items
    .filter((m) => m.kind !== "name" && m.conversationId !== opts.conversationId)
    // Plans go stale: after two weeks "has an exam tomorrow" is noise.
    .filter((m) => m.kind !== "plan" || opts.now - m.createdAt < 14 * 86_400_000)
    .slice(-30)
    .map((m) => ({ text: m.text, daysAgo: Math.floor((opts.now - m.createdAt) / 86_400_000) }));
  return { name, memories };
}
