import type { Mode } from "@/lib/characters/types";
import { peopleRoute } from "@/lib/network/server/http";
import { discover } from "@/lib/network/server/service";

export const GET = peopleRoute(async (request, _ctx, h) => {
  const mode = (new URL(request.url).searchParams.get("mode") ?? "bored") as Mode;
  return Response.json(await discover(await h.member(), mode));
});
