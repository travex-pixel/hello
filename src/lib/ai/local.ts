import { generateOpening, generateReply } from "@/lib/engine/compose";
import type { AiProvider, OpeningRequest, ReplyRequest, ReplyResult } from "./types";

/**
 * The default provider: rule-based, runs entirely in the browser, needs no
 * credentials. See docs/DEMO_MODE.md for what it can and cannot do.
 */
export const localProvider: AiProvider = {
  name: "local",
  async opening(req: OpeningRequest): Promise<ReplyResult> {
    const out = generateOpening({ character: req.character, mode: req.mode, memory: req.memory });
    return { messages: out.messages, memory: out.memory, source: "local" };
  },
  async reply(req: ReplyRequest): Promise<ReplyResult> {
    const out = generateReply({ character: req.character, mode: req.mode, memory: req.memory, userMessage: req.userMessage });
    return { messages: out.messages, memory: out.memory, source: "local" };
  },
};
