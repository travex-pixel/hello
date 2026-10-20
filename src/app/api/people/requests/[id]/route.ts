import { peopleRoute, readJson, requireAccount } from "@/lib/network/server/http";
import { answerRequest } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  const body = await readJson<{ action?: string }>(request);
  const action = body?.action;
  if (action !== "accept" && action !== "decline" && action !== "cancel") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await answerRequest(account, id, action));
});
