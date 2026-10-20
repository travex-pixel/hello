import type { Mode } from "@/lib/characters/types";
import { peopleRoute, readJson } from "@/lib/network/server/http";
import { sendRequest } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ toId?: string; mode?: Mode }>(request);
  if (!body || typeof body.toId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ request: await sendRequest(await h.member(), body.toId, body.mode ?? "bored") });
});
