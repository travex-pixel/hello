import { peopleRoute, requireAccount, readJson } from "@/lib/network/server/http";
import { me, updateSettings } from "@/lib/network/server/service";

export const GET = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  return Response.json(await me(account), { headers: { "cache-control": "no-store" } });
});

export const PATCH = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const body = (await readJson<{ discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }>(request)) ?? {};
  return Response.json(await updateSettings(account, body));
});
