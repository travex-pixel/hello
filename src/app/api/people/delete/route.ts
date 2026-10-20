import { peopleRoute, requireAccount } from "@/lib/network/server/http";
import { deleteAccount } from "@/lib/network/server/service";
import { clearSessionCookie } from "@/lib/network/server/session";

/** Delete the account, its connections and availability. */
export const POST = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  await deleteAccount(account);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
});
