import { readEvents } from "@/lib/ai/client";
import type { ChatContext, HistoryTurn } from "@/lib/ai/prompt";
import type { ChatRequest, ChatStreamEvent } from "@/lib/ai/protocol";
import { defaultDeps, handleChat, type ChatDeps } from "@/lib/ai/server/chat";
import { extractNotes } from "@/lib/memory/extract";
import { memoryContext, mergeMemories, type MemoryItem } from "@/lib/memory/store";
import type { EvalEngine, EvalSession } from "./engines";

/**
 * Drives the real server handler (prompt, model call, streaming, cleanup)
 * the same way the browser does: full history, notes picked up from the
 * person's messages, durable memory carried into the next session.
 */
export function modelEngine(deps: ChatDeps = defaultDeps()): EvalEngine {
  if (!deps.config) throw new Error("No model configured: set ANTHROPIC_API_KEY (and optionally HELLO_AI_MODEL).");
  let n = 0;
  return {
    name: `model-${deps.config.model}`,
    async start(characterId, mode, durable) {
      let items: MemoryItem[] = durable.map((text) => ({ id: `d${++n}`, kind: text.startsWith("goes by ") ? "name" : "fact", text: text.replace(/^goes by /, ""), createdAt: Date.now() - 86_400_000 }));
      const conversationId = `eval-${++n}`;
      const history: HistoryTurn[] = [];
      const notes: string[] = [];

      const call = async (kind: ChatRequest["kind"]) => {
        const { name, memories } = memoryContext(items, { now: Date.now(), conversationId });
        const context: ChatContext = { name, memories, conversationNotes: notes };
        const req = new Request("http://localhost/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "eval" },
          body: JSON.stringify({ characterId, mode, kind, history, context } satisfies ChatRequest),
        });
        const t0 = performance.now();
        let firstMs: number | undefined;
        const bubbles: string[] = [];
        let done: Extract<ChatStreamEvent, { type: "done" }> | undefined;
        let error: string | undefined;
        const res = await handleChat(req, { ...deps, minuteLimiter: { allow: () => true, retryAfterMs: () => 0 }, dayLimiter: { allow: () => true, retryAfterMs: () => 0 } });
        await readEvents(res.body!, (e) => {
          if (e.type === "bubble") {
            if (firstMs === undefined) firstMs = performance.now() - t0;
            bubbles.push(e.text);
          } else if (e.type === "done") done = e;
          else error = e.code;
        });
        const ms = performance.now() - t0;
        if (error) bubbles.push(`[error: ${error}]`);
        for (const b of bubbles) if (!b.startsWith("[error")) history.push({ role: "character", text: b });
        return { replies: bubbles, ms, firstMs, usage: done?.usage ? { input: done.usage.input + done.usage.cacheWrite, output: done.usage.output, cacheRead: done.usage.cacheRead } : undefined };
      };

      const opening = await call("opening");
      const session: EvalSession = {
        opening: opening.replies,
        async reply(userMessage) {
          history.push({ role: "user", text: userMessage });
          const found = extractNotes(userMessage);
          for (const f of found) {
            const t = f.kind === "name" ? `goes by ${f.text}` : f.text;
            if (!notes.includes(t)) notes.push(t);
          }
          items = mergeMemories(items, found, { now: Date.now(), conversationId, newId: () => `m${++n}` });
          return call("reply");
        },
        durableAfter: () => items.map((m) => (m.kind === "name" ? `goes by ${m.text}` : m.text)),
      };
      return session;
    },
  };
}
