import { localProvider } from "./local";
import { serverProvider } from "./server";
import type { AiProvider } from "./types";

export const AI_MODE = process.env.NEXT_PUBLIC_HELLO_AI_MODE === "server" ? "server" : "local";

export function getProvider(): AiProvider {
  return AI_MODE === "server" ? serverProvider : localProvider;
}

export type { AiProvider, ReplyRequest, ReplyResult, HistoryItem } from "./types";
