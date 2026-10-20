import { peopleRoute, readJson } from "@/lib/network/server/http";
import { revokeConnection } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ action?: string; accountId?: string }>(request);
  if (!body || body.action !== "revoke" || typeof body.accountId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await revokeConnection(await h.member(), body.accountId);
  return Response.json({ ok: true });
});
