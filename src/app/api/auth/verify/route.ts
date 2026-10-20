import { peopleRoute, readJson } from "@/lib/network/server/http";
import { LIMITS, limit } from "@/lib/network/server/service";

export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ email?: string; code?: string }>(request);
  const email = body?.email?.trim().toLowerCase() ?? "";
  const code = body?.code?.replace(/\s/g, "") ?? "";
  if (!email || !/^\d{6,10}$/.test(code)) return Response.json({ error: "invalid_code" }, { status: 400 });
  await limit(`verify:ip:${h.ip}`, { limit: 20, windowMs: 60 * 60_000 });
  await limit(`verify:email:${email}`, LIMITS.code);
  const result = await h.auth.verifyCode(email, code);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "rate_limited" ? 429 : 400 });
  return Response.json({ ok: true });
});
