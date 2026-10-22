import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getCharacter } from "@/lib/characters";
import type { Mode } from "@/lib/characters/types";
import { buildContextBlock, buildPersonaPrompt, buildTurns, openingCue, type ChatContext, type HistoryTurn } from "@/lib/ai/prompt";
import { createBubbleSplitter } from "@/lib/ai/sanitize";
import { LIMITS, type ChatErrorCode, type ChatRequest, type ChatStreamEvent, type ChatUsage } from "@/lib/ai/protocol";
import { createRateLimiter, type RateLimiter } from "@/lib/trust/rate-limit";
import { modelSettings, readModelConfig, type ModelConfig } from "./config";

const MODES: Mode[] = ["bored", "warmup", "surprise"];

/** The slice of the SDK this handler uses, so tests can pass a fake. */
export interface StreamingClient {
  beta: { messages: { stream: (params: never, options?: { signal?: AbortSignal }) => AsyncIterable<unknown> & { finalMessage(): Promise<unknown> } } };
}

export interface ChatDeps {
  config: ModelConfig | null;
  client: StreamingClient | null;
  minuteLimiter: RateLimiter;
  dayLimiter: RateLimiter;
  /** Optional ceiling across all addresses. */
  globalLimiter?: RateLimiter;
  now?: () => number;
  log?: (line: Record<string, unknown>) => void;
}

let shared: { deps: ChatDeps; key: string } | null = null;

/** Real dependencies, created once per server instance. */
export function defaultDeps(): ChatDeps {
  const config = readModelConfig();
  const key = config ? `${config.model}:${config.apiKey.slice(-6)}` : "off";
  if (shared && shared.key === key) return shared.deps;
  const deps: ChatDeps = {
    config,
    client: config ? (new Anthropic({ apiKey: config.apiKey, maxRetries: 1, timeout: config.totalTimeoutMs }) as unknown as StreamingClient) : null,
    minuteLimiter: createRateLimiter(config?.perMinute ?? 20, 60_000),
    dayLimiter: createRateLimiter(config?.perDay ?? 400, 86_400_000),
    globalLimiter: createRateLimiter(config?.globalPerDay ?? 5000, 86_400_000),
    log: (line) => console.info(JSON.stringify({ at: "hello.ai", ...line })),
  };
  shared = { deps, key };
  return deps;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export function validateChatRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.characterId !== "string" || !getCharacter(b.characterId)) return null;
  if (typeof b.mode !== "string" || !MODES.includes(b.mode as Mode)) return null;
  if (b.kind !== "opening" && b.kind !== "reply") return null;
  if (!Array.isArray(b.history) || b.history.length > LIMITS.history) return null;
  const history: HistoryTurn[] = [];
  for (const h of b.history) {
    if (!h || typeof h !== "object") return null;
    const item = h as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "character") || typeof item.text !== "string") return null;
    if (item.text.length > LIMITS.messageChars) return null;
    history.push({ role: item.role, text: item.text });
  }
  if (b.kind === "reply" && (history.length === 0 || history[history.length - 1].role !== "user" || !history[history.length - 1].text.trim())) return null;
  if (b.kind === "opening" && history.length > 0) return null;

  const c = (b.context && typeof b.context === "object" ? b.context : {}) as Record<string, unknown>;
  const memories = Array.isArray(c.memories)
    ? c.memories
        .filter((m): m is { text: string; daysAgo: number } => !!m && typeof m === "object" && typeof (m as { text: unknown }).text === "string")
        .slice(0, LIMITS.memories)
        .map((m) => ({ text: m.text.slice(0, LIMITS.noteChars), daysAgo: Math.max(0, Math.min(3650, Math.floor(Number(m.daysAgo) || 0))) }))
    : [];
  const notes = Array.isArray(c.conversationNotes)
    ? c.conversationNotes.filter((n): n is string => typeof n === "string").slice(0, LIMITS.notes).map((n) => n.slice(0, LIMITS.noteChars))
    : [];
  const style = c.style && typeof c.style === "object" ? (c.style as Record<string, unknown>) : undefined;
  const hoursAway = Number(c.hoursAway);
  const context: ChatContext = {
    localTime: str(c.localTime, LIMITS.localTime)?.trim() || undefined,
    hoursAway: Number.isFinite(hoursAway) && hoursAway > 0 ? Math.min(hoursAway, 24 * 365) : undefined,
    name: str(c.name, LIMITS.nameChars)?.trim() || undefined,
    memories,
    conversationNotes: notes,
    style: style
      ? {
          about: str(style.about, LIMITS.styleAbout),
          examples: Array.isArray(style.examples)
            ? style.examples.filter((e): e is string => typeof e === "string").slice(0, LIMITS.styleExamples).map((e) => e.slice(0, LIMITS.styleExampleChars))
            : [],
        }
      : undefined,
  };
  const seed = Number.isInteger(b.seed) ? Math.abs(b.seed as number) % 2 ** 31 : 0;
  return { characterId: b.characterId, mode: b.mode, kind: b.kind, history, context, seed };
}

function line(event: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

function errorResponse(code: ChatErrorCode, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ type: "error", code } satisfies ChatStreamEvent) + "\n", {
    status,
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...headers },
  });
}

function upstreamCode(err: unknown): ChatErrorCode {
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.APIError) return "upstream";
  return "unavailable";
}

/**
 * Streams one reply as NDJSON: a "bubble" event as soon as each message is
 * complete, then "done" with timings and token usage, or a single "error".
 * Nothing is stored. The API key never leaves this function.
 */
export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const { config, client } = deps;
  if (!config || !client) return errorResponse("not_configured", 501);
  const now = deps.now ?? Date.now;

  // On Vercel, x-real-ip and x-vercel-forwarded-for are set by the platform; x-forwarded-for is a fallback for other hosts.
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";
  const limited = (l: RateLimiter, key: string) => (l.allow(key) ? null : Math.max(1, Math.ceil(l.retryAfterMs(key) / 1000)));
  const wait = limited(deps.minuteLimiter, ip) ?? limited(deps.dayLimiter, ip) ?? (deps.globalLimiter ? limited(deps.globalLimiter, "all") : null);
  if (wait !== null) return errorResponse("rate_limited", 429, { "retry-after": String(wait) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const req = validateChatRequest(body);
  if (!req) return errorResponse("bad_request", 400);

  const character = getCharacter(req.characterId)!;
  const mode = req.mode as Mode;
  const contextBlock = buildContextBlock(req.context);
  const system: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
    { type: "text", text: buildPersonaPrompt(character, mode, req.seed), cache_control: { type: "ephemeral" } },
  ];
  if (contextBlock) system.push({ type: "text", text: contextBlock });
  const messages = buildTurns(req.history, openingCue(character, req.seed));

  const started = now();
  const abort = new AbortController();
  const onClientGone = () => abort.abort();
  request.signal?.addEventListener("abort", onClientGone);
  let firstTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort.abort("first_token_timeout"), config.firstTokenTimeoutMs);
  const totalTimer = setTimeout(() => abort.abort("total_timeout"), config.totalTimeoutMs);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const splitter = createBubbleSplitter(character.name);
      let firstMs: number | null = null;
      let sent = 0;
      let failure: ChatErrorCode | null = null;
      let usage: ChatUsage | undefined;
      const send = (text: string) => {
        if (firstMs === null) firstMs = now() - started;
        sent += 1;
        controller.enqueue(line({ type: "bubble", text }));
      };
      try {
        const params = {
          model: config.model,
          max_tokens: config.maxTokens,
          system,
          messages,
          ...modelSettings(config.model),
        };
        const s = client.beta.messages.stream(params as never, { signal: abort.signal });
        for await (const event of s as AsyncIterable<{ type: string; delta?: { type: string; text?: string }; content_block?: { type: string } }>) {
          // A model that thinks first is alive once its thinking starts; don't time that out as "no first token".
          if (event.type === "content_block_start" && event.content_block?.type === "thinking" && firstTimer) {
            clearTimeout(firstTimer);
            firstTimer = undefined;
          }
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            if (firstTimer) {
              clearTimeout(firstTimer);
              firstTimer = undefined;
            }
            for (const b of splitter.push(event.delta.text)) send(b);
          }
        }
        for (const b of splitter.flush()) send(b);
        const final = (await s.finalMessage()) as {
          stop_reason?: string;
          usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
        };
        usage = final.usage
          ? {
              input: final.usage.input_tokens ?? 0,
              output: final.usage.output_tokens ?? 0,
              cacheRead: final.usage.cache_read_input_tokens ?? 0,
              cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
            }
          : undefined;
        if (final.stop_reason === "refusal") failure = "refused";
        else if (sent === 0) failure = "empty";
      } catch (err) {
        if (abort.signal.aborted) failure = request.signal?.aborted ? null : "timeout";
        else failure = upstreamCode(err);
      } finally {
        if (firstTimer) clearTimeout(firstTimer);
        clearTimeout(totalTimer);
        request.signal?.removeEventListener("abort", onClientGone);
      }
      const totalMs = now() - started;
      deps.log?.({ model: config.model, kind: req.kind, character: character.id, bubbles: sent, firstMs, totalMs, usage, error: failure ?? undefined });
      try {
        controller.enqueue(line(failure ? { type: "error", code: failure } : { type: "done", firstMs, totalMs, usage }));
        controller.close();
      } catch {
        /* client went away */
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
