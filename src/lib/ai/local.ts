import { generateOpening, generateReply } from "@/lib/engine/compose";
import type { ConversationEngine, TurnRequest, TurnResult } from "./types";

/**
 * The rule-based engine: runs in the browser, needs no credentials, and is
 * what HELLO uses when no model is configured. See docs/DEMO_MODE.md.
 */
export const localEngine: ConversationEngine = {
  name: "local",
  async turn(req: TurnRequest): Promise<TurnResult> {
    const memory = { ...req.memory, userName: req.memory.userName ?? req.context.name };
    if (req.kind === "opening") {
      const out = generateOpening({ character: req.character, mode: req.mode, memory });
      out.messages.forEach(req.onBubble);
      return { memory: out.memory, source: "local" };
    }
    // The engine answers one message at a time; a burst of texts is read as one.
    const pending: string[] = [];
    for (let i = req.history.length - 1; i >= 0 && req.history[i].role === "user"; i--) pending.unshift(req.history[i].text);
    const out = generateReply({ character: req.character, mode: req.mode, memory, userMessage: pending.join(" ") });
    out.messages.forEach(req.onBubble);
    return { memory: out.memory, source: "local" };
  },
};
