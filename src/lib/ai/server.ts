import { generateReply } from "@/lib/engine/compose";
import { localProvider } from "./local";
import type { AiProvider, OpeningRequest, ReplyRequest, ReplyResult } from "./types";

export interface ServerChatRequest {
  characterId: string;
  mode: string;
  history: { role: "user" | "character"; text: string }[];
  userMessage: string;
  memory: {
    userName?: string;
    likes: string[];
    dislikes: string[];
    facts: string[];
  };
}

export interface ServerChatResponse {
  messages?: string[];
  error?: string;
}

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Optional higher-quality provider. The browser never sees a model key: it
 * calls our own route, which decides whether a model is configured. Any
 * failure falls back to the local engine so the conversation never stalls.
 * The local engine still runs to keep session memory in sync.
 */
export const serverProvider: AiProvider = {
  name: "server",
  opening(req: OpeningRequest) {
    // Openings are authored per character and mode; no model needed.
    return localProvider.opening(req);
  },
  async reply(req: ReplyRequest): Promise<ReplyResult> {
    const local = generateReply({ character: req.character, mode: req.mode, memory: req.memory, userMessage: req.userMessage });
    const body: ServerChatRequest = {
      characterId: req.character.id,
      mode: req.mode,
      history: req.history.slice(-24),
      userMessage: req.userMessage,
      memory: {
        userName: local.memory.userName,
        likes: local.memory.likes.map((l) => l.text),
        dislikes: local.memory.dislikes,
        facts: local.memory.facts.map((f) => f.text),
      },
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`server replied ${res.status}`);
      const data = (await res.json()) as ServerChatResponse;
      if (!data.messages || data.messages.length === 0) throw new Error(data.error ?? "empty reply");
      return { messages: data.messages, memory: local.memory, source: "server" };
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.warn("[hello] server provider failed, using local engine:", err);
      return { messages: local.messages, memory: local.memory, source: "local" };
    }
  },
};
