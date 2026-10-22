import { LIMITS, type ChatErrorCode, type ChatRequest, type ChatStatus, type ChatStreamEvent } from "./protocol";
import type { ConversationEngine, TurnRequest, TurnResult } from "./types";

export class ChatError extends Error {
  constructor(readonly code: ChatErrorCode | "network" | "aborted") {
    super(code);
  }
}

/**
 * Reads an NDJSON body line by line. Lines can arrive split across chunks,
 * or several in one chunk.
 */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: ChatStreamEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const raw = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!raw) continue;
      let event: ChatStreamEvent;
      try {
        event = JSON.parse(raw) as ChatStreamEvent;
      } catch {
        throw new ChatError("upstream");
      }
      onEvent(event);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer.trim()) as ChatStreamEvent);
    } catch {
      throw new ChatError("upstream");
    }
  }
}

/** POST /api/chat and stream the reply, one bubble at a time. Throws ChatError on any failure. */
/** One signal that fires when the caller aborts or the time runs out. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; timedOut: () => boolean; clear: () => void } {
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, ms);
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  else signal?.addEventListener("abort", onAbort);
  return {
    signal: ac.signal,
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** The browser gives up a little after the server would have, so a stalled connection can't leave "typing…" on forever. */
export const CLIENT_TIMEOUT_MS = 35_000;

export async function streamChat(
  body: ChatRequest,
  opts: { signal?: AbortSignal; onBubble: (text: string) => void; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<Extract<ChatStreamEvent, { type: "done" }>> {
  const limit = withTimeout(opts.signal, opts.timeoutMs ?? CLIENT_TIMEOUT_MS);
  try {
    return await streamChatInner(body, { ...opts, signal: limit.signal });
  } catch (err) {
    if (limit.timedOut()) throw new ChatError("timeout");
    throw err;
  } finally {
    limit.clear();
  }
}

async function streamChatInner(
  body: ChatRequest,
  opts: { signal: AbortSignal; onBubble: (text: string) => void; fetchImpl?: typeof fetch },
): Promise<Extract<ChatStreamEvent, { type: "done" }>> {
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch {
    throw new ChatError(opts.signal?.aborted ? "aborted" : "network");
  }
  if (!res.body) throw new ChatError("upstream");
  let done: Extract<ChatStreamEvent, { type: "done" }> | null = null;
  let error: ChatErrorCode | null = null;
  try {
    await readEvents(res.body, (e) => {
      if (e.type === "bubble" && typeof e.text === "string" && e.text.trim()) opts.onBubble(e.text);
      else if (e.type === "done") done = e;
      else if (e.type === "error") error = e.code;
    });
  } catch (err) {
    if (err instanceof ChatError) throw err;
    throw new ChatError(opts.signal?.aborted ? "aborted" : "network");
  }
  if (error) throw new ChatError(error);
  if (!res.ok) throw new ChatError("upstream");
  if (!done) throw new ChatError("network");
  return done;
}

let known: { value: boolean; at: number } | null = null;

/** Record a definite answer, for example a 501 "not configured" from the reply route. */
export function setModelAvailable(value: boolean) {
  known = { value, at: Date.now() };
}

/**
 * Whether the server has a model configured: true, false, or null when the
 * check itself failed. Only definite answers are cached, for five minutes.
 */
export async function modelAvailable(fetchImpl: typeof fetch = fetch): Promise<boolean | null> {
  if (process.env.NEXT_PUBLIC_HELLO_AI_MODE === "local") return false;
  if (known && Date.now() - known.at < 5 * 60_000) return known.value;
  const limit = withTimeout(undefined, 5_000);
  try {
    const r = await fetchImpl("/api/chat", { method: "GET", signal: limit.signal });
    if (!r.ok) return null;
    const s = (await r.json()) as ChatStatus;
    setModelAvailable(!!s.configured);
    return !!s.configured;
  } catch {
    return null;
  } finally {
    limit.clear();
  }
}

/** Model-backed replies through our own server route. The browser never sees a key. */
export const modelEngine: ConversationEngine = {
  name: "model",
  async turn(req: TurnRequest): Promise<TurnResult> {
    const done = await streamChat(
      { characterId: req.character.id, mode: req.mode, kind: req.kind, history: req.history.slice(-LIMITS.history), context: req.context, seed: req.seed },
      { signal: req.signal, onBubble: req.onBubble },
    );
    return { memory: req.memory, source: "model", firstMs: done.firstMs, totalMs: done.totalMs, usage: done.usage };
  },
};
