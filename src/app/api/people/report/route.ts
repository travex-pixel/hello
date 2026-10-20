import { peopleRoute, readJson } from "@/lib/network/server/http";
import { report } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ accountId?: string; reason?: string; conversationId?: string }>(request);
  if (!body || typeof body.accountId !== "string" || typeof body.reason !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await report(await h.member(), body.accountId, body.reason, typeof body.conversationId === "string" ? body.conversationId : undefined);
  return Response.json({ ok: true });
});
