import { clientIp, peopleRoute, readJson } from "@/lib/network/server/http";
import { join, type JoinInput } from "@/lib/network/server/service";
import { sessionCookie } from "@/lib/network/server/session";

export const POST = peopleRoute(async (request) => {
  const body = await readJson<Partial<JoinInput>>(request);
  if (!body || typeof body.inviteCode !== "string" || typeof body.displayName !== "string") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const account = await join(
    {
      inviteCode: body.inviteCode,
      displayName: body.displayName,
      confirmAdult: body.confirmAdult === true,
      discoverable: body.discoverable !== false,
      shareAsMutual: body.shareAsMutual === true,
      disclosedInterests: Array.isArray(body.disclosedInterests) ? body.disclosedInterests.filter((t): t is string => typeof t === "string") : [],
    },
    clientIp(request),
  );
  return Response.json({ id: account.id, displayName: account.displayName }, { headers: { "set-cookie": sessionCookie(account.id) } });
});
