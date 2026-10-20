import type { Mode } from "@/lib/characters/types";
import { peopleRoute, readJson, requireAccount } from "@/lib/network/server/http";
import { sendRequest } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const body = await readJson<{ toId?: string; mode?: Mode }>(request);
  if (!body || typeof body.toId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ request: await sendRequest(account, body.toId, body.mode ?? "bored") });
});
