import { peopleRoute, readJson } from "@/lib/network/server/http";
import { LIMITS, join, limit, type JoinInput } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<Partial<JoinInput>>(request);
  if (!body || typeof body.inviteCode !== "string" || typeof body.displayName !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await limit(`join:${h.ip}`, LIMITS.join);
  let identity = await h.identity();
  if (!identity) {
    // Local memory mode has no email step; Supabase mode requires a verified sign-in first.
    if (h.auth.kind !== "dev") return Response.json({ error: "not_signed_in" }, { status: 401 });
    identity = h.auth.mintDevIdentity();
  }
  const account = await join(identity, {
    inviteCode: body.inviteCode,
    displayName: body.displayName,
    confirmAdult: body.confirmAdult === true,
    discoverable: body.discoverable !== false,
    shareAsMutual: body.shareAsMutual === true,
    disclosedInterests: Array.isArray(body.disclosedInterests) ? body.disclosedInterests.filter((t): t is string => typeof t === "string") : [],
  });
  return Response.json({ id: account.id, displayName: account.displayName });
});
