"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getCharacter } from "@/lib/characters";
import type { Mode } from "@/lib/characters/types";
import { ChatError, getEngine, localEngine, setModelAvailable } from "@/lib/ai";
import { CRISIS_RESOURCES, mightBeCrisis } from "@/lib/safety/crisis";
import type { ChatContext } from "@/lib/ai/prompt";
import { createMemory } from "@/lib/engine/memory";
import { generateOpening } from "@/lib/engine/compose";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/matching";
import { track } from "@/lib/analytics/track";
import { newId } from "@/lib/utils/id";
import { extractNotes } from "@/lib/memory/extract";
import { memoryContext, mergeMemories, type MemoryItem } from "@/lib/memory/store";
import { createBubblePacer, typingDelayMs } from "./pacing";
import type { Conversation, Feedback, Message, Report } from "./types";

const MAX_CONVERSATIONS = 40;
const MAX_RECENT = 4;

interface HelloState {
  hydrated: boolean;
  mode: Mode;
  preferences: Preferences;
  conversations: Record<string, Conversation>;
  /** Newest first. */
  order: string[];
  recentCharacterIds: string[];
  blockedCharacterIds: string[];
  reports: Report[];
  typing: Record<string, boolean>;
  reducedMotion: boolean;
  /** Set when the user has seen the AI-transparency note at least once. */
  seenAiNotice: boolean;
  /** Set by "Meet someone else" so the Discover screen starts immediately. */
  autoStart: boolean;
  /** Durable notes about the person, kept on this device, editable in Profile. */
  memories: MemoryItem[];
  memoryEnabled: boolean;

  setHydrated: () => void;
  setAutoStart: (v: boolean) => void;
  setMode: (mode: Mode) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  setReducedMotion: (v: boolean) => void;
  markAiNoticeSeen: () => void;
  startConversation: (characterId: string, mode: Mode) => Promise<string>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  retryMessage: (conversationId: string, messageId: string) => Promise<void>;
  endConversation: (conversationId: string) => void;
  setFeedback: (conversationId: string, feedback: Feedback) => void;
  deleteConversation: (conversationId: string) => void;
  blockCharacter: (characterId: string) => void;
  unblockCharacter: (characterId: string) => void;
  reportConversation: (conversationId: string, reason: string) => void;
  clearHistory: () => void;
  setMemoryEnabled: (v: boolean) => void;
  updateMemory: (id: string, text: string) => void;
  deleteMemory: (id: string) => void;
  clearMemories: () => void;
}

function userMessageCount(c: Conversation) {
  return c.messages.filter((m) => m.role === "user").length;
}

/** How a durable memory appears in a conversation's notes. */
function noteText(m: { kind: string; text: string }) {
  return m.kind === "name" ? `goes by ${m.text}` : m.text;
}

/** Applies a change to every conversation's notes; returning null removes the note. */
function mapNotes(conversations: Record<string, Conversation>, f: (note: string) => string | null): Record<string, Conversation> {
  const out: Record<string, Conversation> = {};
  for (const [id, c] of Object.entries(conversations)) {
    const notes = (c.notes ?? []).map(f).filter((n): n is string => !!n);
    out[id] = notes.length === (c.notes ?? []).length && notes.every((n, i) => n === c.notes![i]) ? c : { ...c, notes };
  }
  return out;
}

/** Their local day and rough time, so a character can say "it's late" without guessing. */
function localTime(d = new Date()): string {
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const h = d.getHours();
  const part = h < 5 ? "the middle of the night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "late evening";
  return `${day}, ${part}`;
}

/** One reply in flight per conversation. A newer message, ending or deleting the chat cancels it. */
const inflight = new Map<string, AbortController>();

function abortInflight(conversationId: string) {
  inflight.get(conversationId)?.abort();
  inflight.delete(conversationId);
}

const MAX_NOTES = 20;

export const useHello = create<HelloState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      mode: "bored",
      preferences: DEFAULT_PREFERENCES,
      conversations: {},
      order: [],
      recentCharacterIds: [],
      blockedCharacterIds: [],
      reports: [],
      typing: {},
      reducedMotion: false,
      seenAiNotice: false,
      autoStart: false,
      memories: [],
      memoryEnabled: true,

      setHydrated: () => set({ hydrated: true }),
      setAutoStart: (autoStart) => set({ autoStart }),
      setMode: (mode) => {
        if (get().mode !== mode) track("mode_selected", { mode });
        set({ mode });
      },
      setPreferences: (patch) => set((s) => ({ preferences: { ...s.preferences, ...patch } })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      markAiNoticeSeen: () => set({ seenAiNotice: true }),

      startConversation: async (characterId, mode) => {
        const character = getCharacter(characterId);
        if (!character) throw new Error(`Unknown character ${characterId}`);
        const id = newId("c");
        const now = Date.now();
        const memory = createMemory();
        const name = get().preferences.displayName ?? get().memories.find((m) => m.kind === "name")?.text;
        if (name) memory.userName = name;
        const messages: Message[] = [
          {
            id: newId("m"),
            role: "system",
            text: `${character.name} is an AI character, not a person. This chat is saved on this device.`,
            ts: now,
          },
        ];
        const conversation: Conversation = {
          id,
          characterId,
          mode,
          source: "ai",
          startedAt: now,
          messages,
          memory,
          milestones: {},
          notes: [],
          seed: Math.floor(Math.random() * 2 ** 31),
        };
        set((s) => {
          const order = [id, ...s.order].slice(0, MAX_CONVERSATIONS);
          const conversations: Record<string, Conversation> = { [id]: conversation };
          for (const cid of order) if (s.conversations[cid]) conversations[cid] = s.conversations[cid];
          return {
            conversations,
            order,
            recentCharacterIds: [characterId, ...s.recentCharacterIds.filter((c) => c !== characterId)].slice(0, MAX_RECENT),
          };
        });
        // The first message streams in on the chat screen, with the typing indicator.
        void runTurn(id, "opening");
        return id;
      },

      sendMessage: async (conversationId, rawText) => {
        const text = rawText.trim().slice(0, 1000);
        if (!text) return;
        const conversation = get().conversations[conversationId];
        if (!conversation || conversation.endedAt) return;
        const character = getCharacter(conversation.characterId);
        if (!character) return;

        const userMsg: Message = { id: newId("m"), role: "user", text, ts: Date.now(), status: "sent" };
        // Safety resources come from HELLO itself, before and regardless of any reply.
        const safety: Message[] = mightBeCrisis(text)
          ? [{ id: newId("m"), role: "system", kind: "safety", text: `${CRISIS_RESOURCES.title}. ${CRISIS_RESOURCES.body}`, ts: Date.now() }]
          : [];
        const remember = get().memoryEnabled;
        const notes = remember ? extractNotes(text) : [];
        set((s) => {
          const c = s.conversations[conversationId];
          const fresh = notes.map((n) => (n.kind === "name" ? `goes by ${n.text}` : n.text)).filter((t) => !(c.notes ?? []).includes(t));
          // A new message is answered together with any earlier one whose reply failed, so those stop asking for a retry.
          const earlier = c.messages.map((m) => (m.replyFailed ? { ...m, replyFailed: false } : m));
          return {
            conversations: { ...s.conversations, [conversationId]: { ...c, messages: [...earlier, userMsg, ...safety], notes: [...(c.notes ?? []), ...fresh].slice(-MAX_NOTES) } },
            memories: notes.length ? mergeMemories(s.memories, notes, { now: Date.now(), conversationId, newId: () => newId("k") }) : s.memories,
          };
        });

        const count = userMessageCount(get().conversations[conversationId]);
        if (count === 1 && !conversation.milestones.firstMessage) {
          track("first_message_sent", { mode: conversation.mode, characterId: character.id, conversationId, msSinceAccept: Date.now() - conversation.startedAt });
          set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...s.conversations[conversationId], milestones: { ...s.conversations[conversationId].milestones, firstMessage: true } } } }));
        } else {
          track("message_sent", { mode: conversation.mode, characterId: character.id, conversationId, messageCount: count });
        }
        if (count === 5 && !conversation.milestones.reachedFive) {
          track("conversation_reached_5", { mode: conversation.mode, characterId: character.id, conversationId });
          set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...s.conversations[conversationId], milestones: { ...s.conversations[conversationId].milestones, reachedFive: true } } } }));
        }

        await runTurn(conversationId, "reply");
      },

      retryMessage: async (conversationId, messageId) => {
        const conversation = get().conversations[conversationId];
        const failed = conversation?.messages.find((m) => m.id === messageId && (m.status === "failed" || m.replyFailed));
        if (!conversation || !failed) return;
        // Only retry when nothing has been said since; otherwise just clear the flag.
        const after = conversation.messages.slice(conversation.messages.indexOf(failed) + 1).filter((m) => m.role !== "system");
        if (after.length > 0) {
          set((s) => ({
            conversations: { ...s.conversations, [conversationId]: { ...conversation, messages: conversation.messages.map((m) => (m.id === messageId ? { ...m, replyFailed: false } : m)) } },
          }));
          return;
        }
        set((s) => ({
          conversations: {
            ...s.conversations,
            [conversationId]: { ...conversation, messages: conversation.messages.map((m) => (m.id === messageId ? { ...m, status: "sent" as const, replyFailed: false } : m)) },
          },
        }));
        await runTurn(conversationId, "reply");
      },

      endConversation: (conversationId) => {
        const c = get().conversations[conversationId];
        if (!c || c.endedAt) return;
        abortInflight(conversationId);
        track("conversation_ended", { mode: c.mode, characterId: c.characterId, conversationId, messageCount: userMessageCount(c) });
        set((s) => ({
          conversations: { ...s.conversations, [conversationId]: { ...c, endedAt: Date.now() } },
          typing: { ...s.typing, [conversationId]: false },
        }));
      },

      setFeedback: (conversationId, feedback) => {
        const c = get().conversations[conversationId];
        if (!c) return;
        track("feedback_submitted", { mode: c.mode, characterId: c.characterId, conversationId, feedback });
        set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...c, feedback } } }));
      },

      deleteConversation: (conversationId) => {
        abortInflight(conversationId);
        set((s) => {
          const conversations = { ...s.conversations };
          delete conversations[conversationId];
          return { conversations, order: s.order.filter((id) => id !== conversationId) };
        });
      },

      blockCharacter: (characterId) => set((s) => ({ blockedCharacterIds: Array.from(new Set([...s.blockedCharacterIds, characterId])) })),
      unblockCharacter: (characterId) => set((s) => ({ blockedCharacterIds: s.blockedCharacterIds.filter((id) => id !== characterId) })),

      reportConversation: (conversationId, reason) => {
        const c = get().conversations[conversationId];
        if (!c) return;
        const report: Report = { id: newId("r"), conversationId, characterId: c.characterId, reason, ts: Date.now() };
        set((s) => ({ reports: [...s.reports, report] }));
        get().endConversation(conversationId);
      },

      clearHistory: () => {
        for (const id of Array.from(inflight.keys())) abortInflight(id);
        set({ conversations: {}, order: [], recentCharacterIds: [], reports: [], typing: {}, memories: [] });
      },

      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      // Edits and deletions reach the notes kept inside conversations too, so a forgotten fact is really forgotten.
      updateMemory: (id, text) =>
        set((s) => {
          const target = s.memories.find((m) => m.id === id);
          if (!target) return {};
          const next = text.trim().slice(0, 120);
          const from = noteText(target);
          const to = next ? noteText({ ...target, text: next }) : null;
          return {
            memories: s.memories.map((m) => (m.id === id ? { ...m, text: next } : m)).filter((m) => m.text.length > 0),
            conversations: mapNotes(s.conversations, (n) => (n === from ? to : n)),
          };
        }),
      deleteMemory: (id) =>
        set((s) => {
          const target = s.memories.find((m) => m.id === id);
          const from = target ? noteText(target) : null;
          return { memories: s.memories.filter((m) => m.id !== id), conversations: mapNotes(s.conversations, (n) => (n === from ? null : n)) };
        }),
      clearMemories: () => set((s) => ({ memories: [], conversations: mapNotes(s.conversations, () => null) })),
    }),
    {
      name: "hello.v1",
      storage: createJSONStorage(() => localStorage),
      // Rehydrate after React hydration so server and first client render match.
      skipHydration: true,
      partialize: (s) => ({
        mode: s.mode,
        preferences: s.preferences,
        conversations: s.conversations,
        order: s.order,
        recentCharacterIds: s.recentCharacterIds,
        blockedCharacterIds: s.blockedCharacterIds,
        reports: s.reports,
        seenAiNotice: s.seenAiNotice,
        memories: s.memories,
        memoryEnabled: s.memoryEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/**
 * Asks the engine for the character's next message(s) and shows them with
 * natural pacing. Model output streams in, so the first bubble can appear
 * while later ones are still being written. A failure is shown at once,
 * never hidden behind a typing indicator, and never swapped for a scripted
 * line, except that a failed opening falls back to the character's own
 * authored first line.
 */
async function runTurn(conversationId: string, kind: "opening" | "reply") {
  const get = useHello.getState;
  const set = useHello.setState;
  abortInflight(conversationId);
  const ac = new AbortController();
  inflight.set(conversationId, ac);
  const isCurrent = () => inflight.get(conversationId) === ac && !ac.signal.aborted;

  const conversation = get().conversations[conversationId];
  const character = conversation && getCharacter(conversation.characterId);
  if (!conversation || !character) return;

  const state = get();
  const startedAt = Date.now();
  const spoken = conversation.messages.filter((m) => m.role !== "system" && !(m.role === "user" && m.status === "failed"));
  const history = spoken.map((m) => ({ role: m.role as "user" | "character", text: m.text }));
  // How long since the previous message, if they've come back to an old chat.
  const lastUser = spoken[spoken.length - 1];
  const before = spoken[spoken.length - 2];
  const hoursAway = kind === "reply" && lastUser && before ? (lastUser.ts - before.ts) / 3_600_000 : undefined;
  const { name, memories } = memoryContext(state.memoryEnabled ? state.memories : [], {
    now: startedAt,
    conversationId,
    displayName: state.preferences.displayName,
  });
  const context: ChatContext = {
    name,
    memories,
    conversationNotes: state.memoryEnabled ? (conversation.notes ?? []) : [],
    style: state.preferences.style,
    localTime: localTime(),
    hoursAway: hoursAway && hoursAway >= 3 ? hoursAway : undefined,
  };
  const setTyping = (on: boolean) => set((s) => ({ typing: { ...s.typing, [conversationId]: on } }));

  let firstShownAt: number | null = null;
  const pacer = createBubblePacer({
    startedAt,
    delayFor: (text, i) => (kind === "opening" && i === 0 ? Math.min(900, typingDelayMs(text, i, { reduced: get().reducedMotion })) : typingDelayMs(text, i, { reduced: get().reducedMotion })),
    show: (text) => {
      if (!isCurrent()) return;
      if (firstShownAt === null) firstShownAt = Date.now();
      const msg: Message = { id: newId("m"), role: "character", text, ts: Date.now() };
      set((s) => {
        const c = s.conversations[conversationId];
        if (!c || c.endedAt) return {};
        return { conversations: { ...s.conversations, [conversationId]: { ...c, messages: [...c.messages, msg] } } };
      });
    },
  });

  setTyping(true);
  let engineName: "model" | "local" = "local";
  try {
    let engine = await getEngine();
    engineName = engine.name;
    const request = {
      character,
      mode: conversation.mode,
      kind,
      history,
      memory: conversation.memory,
      context,
      seed: conversation.seed,
      signal: ac.signal,
      onBubble: (text: string) => void (isCurrent() && pacer.push(text)),
    };
    let result;
    try {
      result = await engine.turn(request);
    } catch (err) {
      // "No model here" is a definite answer, not a failure: this deployment runs the local engine.
      if (!(err instanceof ChatError && err.code === "not_configured")) throw err;
      setModelAvailable(false);
      engine = localEngine;
      engineName = "local";
      result = await engine.turn(request);
    }
    pacer.end();
    await pacer.done;
    if (!isCurrent()) return;
    set((s) => {
      const c = s.conversations[conversationId];
      if (!c) return {};
      // A reply arrived, so nothing earlier is still waiting for one.
      const messages = c.messages.some((m) => m.replyFailed) ? c.messages.map((m) => (m.replyFailed ? { ...m, replyFailed: false } : m)) : c.messages;
      return { conversations: { ...s.conversations, [conversationId]: { ...c, messages, memory: result.memory, engine: result.source } } };
    });
    const after = get().conversations[conversationId];
    if (kind === "reply" && after && !after.milestones.firstResponse) {
      track("first_response_received", { mode: after.mode, characterId: character.id, conversationId, source: "ai" });
      set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...s.conversations[conversationId], milestones: { ...s.conversations[conversationId].milestones, firstResponse: true } } } }));
    }
    track("reply_timing", {
      mode: conversation.mode,
      characterId: character.id,
      engine: result.source,
      msToFirstBubble: firstShownAt === null ? undefined : firstShownAt - startedAt,
      msToComplete: Date.now() - startedAt,
      modelFirstMs: result.firstMs ?? undefined,
    });
  } catch (err) {
    pacer.cancel();
    if (!isCurrent()) return;
    const code = err instanceof ChatError ? err.code : "unavailable";
    track("ai_reply_failed", { mode: conversation.mode, characterId: character.id, engine: engineName, reason: code });
    if (kind === "opening") {
      // The character's own authored first line keeps the chat usable; the next reply tries the model again.
      if (pacer.shown === 0) {
        const out = generateOpening({ character, mode: conversation.mode, memory: conversation.memory });
        set((s) => {
          const c = s.conversations[conversationId];
          if (!c) return {};
          const lines = out.messages.map((text) => ({ id: newId("m"), role: "character" as const, text, ts: Date.now() }));
          return { conversations: { ...s.conversations, [conversationId]: { ...c, memory: out.memory, messages: [...c.messages, ...lines] } } };
        });
      }
    } else if (pacer.shown === 0) {
      // Mark the person's latest message so they can retry; nothing pretends to be a reply.
      set((s) => {
        const c = s.conversations[conversationId];
        if (!c) return {};
        const lastUser = [...c.messages].reverse().find((m) => m.role === "user");
        return {
          conversations: {
            ...s.conversations,
            [conversationId]: { ...c, messages: c.messages.map((m) => (m.id === lastUser?.id ? { ...m, replyFailed: true } : m)) },
          },
        };
      });
    }
  } finally {
    if (inflight.get(conversationId) === ac) {
      inflight.delete(conversationId);
      setTyping(false);
    }
  }
}
