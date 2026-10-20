import { peopleRoute } from "@/lib/network/server/http";
import { createInvite } from "@/lib/network/server/service";

export const POST = peopleRoute(async (_request, _ctx, h) => Response.json(await createInvite(await h.member())));
