import { peopleRoute, readJson } from "@/lib/network/server/http";
import { LIMITS, limit } from "@/lib/network/server/service";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Emails a six-digit sign-in code. Says nothing about whether the address already has an account. */
export const POST = peopleRoute(async (request, _ctx, h) => {
  const body = await readJson<{ email?: string }>(request);
  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email)) return Response.json({ error: "invalid_email" }, { status: 400 });
  await limit(`code:ip:${h.ip}`, LIMITS.code);
  await limit(`code:email:${email}`, LIMITS.code);
  const result = await h.auth.sendCode(email);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "rate_limited" ? 429 : result.error === "invalid_email" ? 400 : 503 });
  return Response.json({ ok: true });
});
