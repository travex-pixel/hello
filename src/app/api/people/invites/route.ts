import { peopleRoute, requireAccount } from "@/lib/network/server/http";
import { createInvite } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  return Response.json(await createInvite(account));
});
