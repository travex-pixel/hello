import { peopleRoute, readJson, requireAccount } from "@/lib/network/server/http";
import { block } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request) => {
  const account = requireAccount(request);
  if (account instanceof Response) return account;
  const body = await readJson<{ accountId?: string }>(request);
  if (!body || typeof body.accountId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  await block(account, body.accountId);
  return Response.json({ ok: true });
});
