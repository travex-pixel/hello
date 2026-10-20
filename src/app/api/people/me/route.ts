import { peopleRoute, readJson } from "@/lib/network/server/http";
import { me, updateSettings } from "@/lib/network/server/service";

export const GET = peopleRoute(async (_request, _ctx, h) => Response.json(await me(await h.member())));

export const PATCH = peopleRoute(async (request, _ctx, h) => {
  const body = (await readJson<{ discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }>(request)) ?? {};
  return Response.json(await updateSettings(await h.member(), body));
});
