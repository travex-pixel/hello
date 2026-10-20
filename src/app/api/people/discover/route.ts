import type { Mode } from "@/lib/characters/types";
import { peopleRoute, requireAccount } from "@/lib/network/server/http";
import { discover } from "@/lib/network/server/service";

export const GET = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const mode = (new URL(request.url).searchParams.get("mode") ?? "bored") as Mode;
  return Response.json(await discover(account, mode), { headers: { "cache-control": "no-store" } });
});
