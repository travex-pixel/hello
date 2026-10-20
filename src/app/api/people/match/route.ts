import type { Mode } from "@/lib/characters/types";
import { peopleRoute, readJson } from "@/lib/network/server/http";
import { match } from "@/lib/network/server/service";

/** "Chat with a mate": safe to call repeatedly while looking. */
export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ mode?: Mode; since?: number }>(request);
  const since = typeof body?.since === "number" && Number.isFinite(body.since) ? body.since : Date.now();
  return Response.json(await match(await h.member(), body?.mode ?? "bored", since));
});
