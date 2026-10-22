import { connection } from "next/server";
import { defaultDeps, handleChat } from "@/lib/ai/server/chat";
import type { ChatStatus } from "@/lib/ai/protocol";

/**
 * Model-backed replies for the AI characters. Off unless ANTHROPIC_API_KEY
 * is set on the server (see docs/AI_CONVERSATION.md). The key never reaches
 * the browser; when the model is off the browser uses the local engine.
 */
export async function POST(request: Request) {
  return handleChat(request, defaultDeps());
}

/** Lets the browser know whether model replies are available, without revealing anything else. */
export async function GET() {
  await connection();
  const body: ChatStatus = { configured: !!defaultDeps().config };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
