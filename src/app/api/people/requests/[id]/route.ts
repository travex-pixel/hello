import { peopleRoute, readJson } from "@/lib/network/server/http";
import { answerRequest } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, ctx: { params: Promise<{ id: string }> }, h) => {
  const { id } = await ctx.params;
  const body = await readJson<{ action?: string }>(request);
  const action = body?.action;
  if (action !== "accept" && action !== "decline" && action !== "cancel") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await answerRequest(await h.member(), id, action));
});
