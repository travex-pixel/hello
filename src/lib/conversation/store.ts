"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getCharacter } from "@/lib/characters";
import type { Mode } from "@/lib/characters/types";
import { getProvider } from "@/lib/ai";
import { createMemory } from "@/lib/engine/memory";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/matching";
import { track } from "@/lib/analytics/track";
import { newId } from "@/lib/utils/id";
import { typingDelayMs } from "./pacing";
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
}

function userMessageCount(c: Conversation) {
  return c.messages.filter((m) => m.role === "user").length;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
        let memory = createMemory();
        if (get().preferences.displayName) memory.userName = get().preferences.displayName;
        const opening = await getProvider().opening({ character, mode, memory });
        memory = opening.memory;
        const messages: Message[] = [
          {
            id: newId("m"),
            role: "system",
            text: `${character.name} is an AI character. Replies are generated for this demo and this chat stays on your device.`,
            ts: now,
          },
          ...opening.messages.map((text, i) => ({ id: newId("m"), role: "character" as const, text, ts: now + i })),
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
        return id;
      },

      sendMessage: async (conversationId, rawText) => {
        const text = rawText.trim().slice(0, 1000);
        if (!text) return;
        const state = get();
        const conversation = state.conversations[conversationId];
        if (!conversation || conversation.endedAt) return;
        const character = getCharacter(conversation.characterId);
        if (!character) return;

        const userMsg: Message = { id: newId("m"), role: "user", text, ts: Date.now(), status: "sent" };
        set((s) => ({
          conversations: { ...s.conversations, [conversationId]: { ...s.conversations[conversationId], messages: [...s.conversations[conversationId].messages, userMsg] } },
          typing: { ...s.typing, [conversationId]: true },
        }));

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

        try {
          const current = get().conversations[conversationId];
          const history = current.messages
            .filter((m) => m.role !== "system")
            .slice(0, -1)
            .map((m) => ({ role: m.role as "user" | "character", text: m.text }));
          const result = await getProvider().reply({ character, mode: current.mode, memory: current.memory, history, userMessage: text });

          for (let i = 0; i < result.messages.length; i++) {
            const bubble = result.messages[i];
            await sleep(typingDelayMs(bubble, get().reducedMotion));
            if (!get().conversations[conversationId] || get().conversations[conversationId].endedAt) break;
            const reply: Message = { id: newId("m"), role: "character", text: bubble, ts: Date.now() };
            set((s) => ({
              conversations: {
                ...s.conversations,
                [conversationId]: {
                  ...s.conversations[conversationId],
                  memory: result.memory,
                  messages: [...s.conversations[conversationId].messages, reply],
                },
              },
              typing: { ...s.typing, [conversationId]: i < result.messages.length - 1 },
            }));
          }
          const after = get().conversations[conversationId];
          if (after && !after.milestones.firstResponse) {
            track("first_response_received", { mode: after.mode, characterId: character.id, conversationId });
            set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...s.conversations[conversationId], milestones: { ...s.conversations[conversationId].milestones, firstResponse: true } } } }));
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") console.error("[hello] reply failed", err);
          set((s) => ({
            conversations: {
              ...s.conversations,
              [conversationId]: {
                ...s.conversations[conversationId],
                messages: s.conversations[conversationId].messages.map((m) => (m.id === userMsg.id ? { ...m, status: "failed" as const } : m)),
              },
            },
          }));
        } finally {
          set((s) => ({ typing: { ...s.typing, [conversationId]: false } }));
        }
      },

      retryMessage: async (conversationId, messageId) => {
        const conversation = get().conversations[conversationId];
        const failed = conversation?.messages.find((m) => m.id === messageId && m.status === "failed");
        if (!conversation || !failed) return;
        set((s) => ({
          conversations: { ...s.conversations, [conversationId]: { ...conversation, messages: conversation.messages.filter((m) => m.id !== messageId) } },
        }));
        await get().sendMessage(conversationId, failed.text);
      },

      endConversation: (conversationId) => {
        const c = get().conversations[conversationId];
        if (!c || c.endedAt) return;
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

      clearHistory: () =>
        set({ conversations: {}, order: [], recentCharacterIds: [], reports: [], typing: {} }),
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
