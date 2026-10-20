import { peopleRoute } from "@/lib/network/server/http";
import { endConversation } from "@/lib/network/server/service";

export const POST = peopleRoute(async (_request, ctx: { params: Promise<{ id: string }> }, h) => {
  const { id } = await ctx.params;
  await endConversation(await h.member(), id);
  return Response.json({ ok: true });
});
