import { peopleRoute } from "@/lib/network/server/http";
import { deleteAccount } from "@/lib/network/server/service";

/**
 * Deletes the member's account and personal data, then their sign-in
 * (email address) from the auth provider, then signs them out.
 */
export const POST = peopleRoute(async (_request, _ctx, h) => {
  const account = await h.member();
  await deleteAccount(account);
  const authRemoved = await h.auth.deleteUser(account.authUserId);
  await h.auth.signOut();
  return Response.json({ ok: true, authRemoved });
});
