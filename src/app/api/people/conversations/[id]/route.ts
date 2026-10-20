import { peopleRoute, readJson, requireAccount } from "@/lib/network/server/http";
import { getConversation, sendMessage } from "@/lib/network/server/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = peopleRoute(async (request, ctx: Ctx) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0) || 0;
  return Response.json(await getConversation(account, id, since), { headers: { "cache-control": "no-store" } });
});

export const POST = peopleRoute(async (request, ctx: Ctx) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  const body = await readJson<{ text?: string }>(request);
  if (!body || typeof body.text !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await sendMessage(account, id, body.text));
});
