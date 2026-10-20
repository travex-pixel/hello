import { connection } from "next/server";
import { peopleRoute } from "@/lib/network/server/http";
import { status } from "@/lib/network/server/service";

/** Depends on configuration and the visitor's session, so never prerender it. */
export const GET = peopleRoute(
  async (_request, _ctx, h) => {
    await connection();
    return Response.json(await status(await h.identity(), h.auth.kind));
  },
  { allowWhenDisabled: true },
);
