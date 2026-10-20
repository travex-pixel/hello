import { peopleRoute, readJson } from "@/lib/network/server/http";
import { revokeInvite } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ code?: string }>(request);
  if (!body || typeof body.code !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await revokeInvite(await h.member(), body.code);
  return Response.json({ ok: true });
});
