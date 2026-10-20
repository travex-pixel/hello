import type { Mode } from "@/lib/characters/types";
import { peopleRoute, readJson, requireAccount } from "@/lib/network/server/http";
import { setAvailability } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const body = await readJson<{ on?: boolean; mode?: Mode }>(request);
  if (!body || typeof body.on !== "boolean") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ availability: await setAvailability(account, body.on, body.mode ?? "bored") });
});
