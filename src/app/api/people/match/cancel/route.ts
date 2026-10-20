import { peopleRoute } from "@/lib/network/server/http";
import { cancelMatch } from "@/lib/network/server/service";

export const POST = peopleRoute(async (_request, _ctx, h) => {
  await cancelMatch(await h.member());
  return Response.json({ ok: true });
});
