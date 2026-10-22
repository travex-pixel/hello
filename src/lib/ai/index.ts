import { localEngine } from "./local";
import { modelAvailable, modelEngine } from "./client";
import type { ConversationEngine } from "./types";

/**
 * The model when the server has one configured, the local engine when it
 * definitely doesn't. If the check itself failed, try the model: its reply
 * route answers "not_configured" or fails honestly, and never quietly
 * downgrades a conversation to scripted lines.
 */
export async function getEngine(): Promise<ConversationEngine> {
  return (await modelAvailable()) === false ? localEngine : modelEngine;
}

export { localEngine };
export { ChatError, setModelAvailable } from "./client";
export type { ConversationEngine, TurnRequest, TurnResult, HistoryTurn } from "./types";
