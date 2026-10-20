import { peopleRoute } from "@/lib/network/server/http";

export const POST = peopleRoute(async (_request, _ctx, h) => {
  await h.auth.signOut();
  return Response.json({ ok: true });
});
