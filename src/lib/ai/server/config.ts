import "server-only";

/**
 * Server-side model configuration. Everything comes from environment
 * variables that never reach the browser. With no key, the model path is
 * off and the browser uses the local engine.
 */
export interface ModelConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  firstTokenTimeoutMs: number;
  totalTimeoutMs: number;
  perMinute: number;
  perDay: number;
  /** All addresses together, per server instance: a ceiling on spend if limits are dodged. */
  globalPerDay: number;
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function readModelConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig | null {
  const provider = env.HELLO_AI_PROVIDER ?? "anthropic";
  if (provider !== "anthropic" || !env.ANTHROPIC_API_KEY) return null;
  return {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.HELLO_AI_MODEL || DEFAULT_MODEL,
    // A text message needs little; models that always think need room for it.
    maxTokens: num(env.HELLO_AI_MAX_TOKENS, /^claude-(opus|fable)-/.test(env.HELLO_AI_MODEL || DEFAULT_MODEL) ? 1024 : 400),
    firstTokenTimeoutMs: num(env.HELLO_AI_FIRST_TOKEN_TIMEOUT_MS, 10_000),
    totalTimeoutMs: num(env.HELLO_AI_TIMEOUT_MS, 25_000),
    perMinute: num(env.HELLO_AI_RATE_PER_MINUTE, 20),
    perDay: num(env.HELLO_AI_RATE_PER_DAY, 400),
    globalPerDay: num(env.HELLO_AI_GLOBAL_PER_DAY, 5000),
  };
}

/**
 * Per-model request settings for a short, fast casual reply. Thinking is
 * switched off where the model allows it (it adds latency and nothing a
 * text message needs); where it can't be switched off, effort is low.
 */
export function modelSettings(model: string): Record<string, unknown> {
  if (model.startsWith("claude-haiku-5")) return { thinking: { type: "disabled" }, output_config: { effort: "low" } };
  if (model.startsWith("claude-sonnet-5-5")) {
    return { thinking: { type: "between_tools" }, output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  }
  if (model.startsWith("claude-opus-5") || model.startsWith("claude-fable-5")) {
    return { output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  }
  return {};
}
