import { peopleRoute, readJson } from "@/lib/network/server/http";
import { block } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ accountId?: string }>(request);
  if (!body || typeof body.accountId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await block(await h.member(), body.accountId);
  return Response.json({ ok: true });
});
