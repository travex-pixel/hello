import { peopleRoute, requireAccount } from "@/lib/network/server/http";
import { endConversation } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  await endConversation(account, id);
  return Response.json({ ok: true });
});
