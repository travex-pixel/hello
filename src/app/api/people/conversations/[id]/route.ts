import { peopleRoute, readJson } from "@/lib/network/server/http";
import { getConversation, sendMessage } from "@/lib/network/server/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = peopleRoute(async (request, ctx: Ctx, h) => {
  const { id } = await ctx.params;
  const after = Number(new URL(request.url).searchParams.get("after") ?? 0) || 0;
  return Response.json(await getConversation(await h.member(), id, after));
});

export const POST = peopleRoute(async (request, ctx: Ctx, h) => {
  const { id } = await ctx.params;
  const body = await readJson<{ text?: string; clientId?: string }>(request);
  if (!body || typeof body.text !== "string" || typeof body.clientId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await sendMessage(await h.member(), id, body.text, body.clientId));
});
