import Anthropic from "@anthropic-ai/sdk";
import { getCharacter } from "@/lib/characters";
import type { Mode } from "@/lib/characters/types";
import { buildPersonaPrompt } from "@/lib/ai/persona";
import type { ServerChatRequest, ServerChatResponse } from "@/lib/ai/server";
import { createRateLimiter } from "@/lib/trust/rate-limit";

/**
 * Optional model-backed replies. Disabled unless HELLO_AI_PROVIDER=anthropic
 * and ANTHROPIC_API_KEY are set on the server. The browser never receives the
 * key, and when this route is unavailable the client uses the local engine.
 */

const MODES: Mode[] = ["bored", "warmup", "surprise"];
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 24;
const limiter = createRateLimiter(30, 60_000);

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (process.env.HELLO_AI_PROVIDER !== "anthropic" || !process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function json(body: ServerChatResponse, status = 200) {
  return Response.json(body, { status });
}

function validate(body: unknown): ServerChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.characterId !== "string" || !getCharacter(b.characterId)) return null;
  if (typeof b.mode !== "string" || !MODES.includes(b.mode as Mode)) return null;
  if (typeof b.userMessage !== "string" || b.userMessage.trim().length === 0 || b.userMessage.length > MAX_MESSAGE_CHARS) return null;
  const history = Array.isArray(b.history) ? b.history : [];
  if (history.length > MAX_HISTORY) return null;
  for (const h of history) {
    if (!h || typeof h !== "object") return null;
    const item = h as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "character") || typeof item.text !== "string" || item.text.length > MAX_MESSAGE_CHARS) return null;
  }
  const mem = (b.memory && typeof b.memory === "object" ? b.memory : {}) as Record<string, unknown>;
  const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 80)) : []);
  return {
    characterId: b.characterId,
    mode: b.mode,
    userMessage: b.userMessage,
    history: history as ServerChatRequest["history"],
    memory: {
      userName: typeof mem.userName === "string" ? mem.userName.slice(0, 30) : undefined,
      likes: strList(mem.likes),
      dislikes: strList(mem.dislikes),
      facts: strList(mem.facts),
    },
  };
}

export async function POST(request: Request) {
  const anthropic = getClient();
  if (!anthropic) return json({ error: "not_configured" }, 501);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!limiter.allow(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(Math.ceil(limiter.retryAfterMs(ip) / 1000)) } });
  }

  let parsed: ServerChatRequest | null = null;
  try {
    parsed = validate(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return json({ error: "bad_request" }, 400);

  const character = getCharacter(parsed.characterId)!;
  const mode = parsed.mode as Mode;
  const persona = buildPersonaPrompt(character, mode);
  const remembered = [
    parsed.memory.userName ? `Their name: ${parsed.memory.userName}.` : "",
    parsed.memory.likes.length ? `They like: ${parsed.memory.likes.join("; ")}.` : "",
    parsed.memory.dislikes.length ? `They dislike: ${parsed.memory.dislikes.join("; ")}.` : "",
    parsed.memory.facts.length ? `They mentioned: ${parsed.memory.facts.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const messages: Anthropic.MessageParam[] = parsed.history.map((h) => ({
    role: h.role === "user" ? "user" : "assistant",
    content: h.text,
  }));
  // The API requires the first turn to be the user's; our character opens.
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  messages.push({ role: "user", content: parsed.userMessage });

  try {
    const response = await anthropic.beta.messages.create({
      model: process.env.HELLO_AI_MODEL || "claude-opus-5-5",
      max_tokens: 400,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: persona, cache_control: { type: "ephemeral" } },
        ...(remembered ? [{ type: "text" as const, text: `Remembered from this conversation: ${remembered}` }] : []),
      ],
      messages,
    });

    if (response.stop_reason === "refusal") return json({ error: "refused" }, 200);

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return json({ error: "empty" }, 200);

    const bubbles = text
      .split(/\n\s*\n/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 2);
    return json({ messages: bubbles });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "upstream_rate_limited" }, 503);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "upstream_auth" }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: `upstream_${err.status ?? "error"}` }, 503);
    return json({ error: "upstream_unavailable" }, 503);
  }
}
