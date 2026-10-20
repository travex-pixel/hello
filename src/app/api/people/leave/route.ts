import { peopleRoute } from "@/lib/network/server/http";
import { clearSessionCookie } from "@/lib/network/server/session";

/** Sign out on this device. The account stays. */
export const POST = peopleRoute(async () => {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
});
