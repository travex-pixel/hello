import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccountId } from "../types";

const COOKIE = "hello_people";

declare global {
  var __helloSessionSecret: string | undefined;
}

function secret(): string {
  if (process.env.HELLO_SESSION_SECRET) return process.env.HELLO_SESSION_SECRET;
  // Local test mode only: a per-process secret means sessions reset on restart, like the store.
  if (!globalThis.__helloSessionSecret) globalThis.__helloSessionSecret = randomBytes(32).toString("hex");
  return globalThis.__helloSessionSecret;
}

function sign(accountId: AccountId): string {
  return createHmac("sha256", secret()).update(accountId).digest("hex").slice(0, 40);
}

export function sessionCookie(accountId: AccountId): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${accountId}.${sign(accountId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Returns the account id when the cookie carries a valid signature. */
export function readSession(request: Request): AccountId | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const value = match.slice(COOKIE.length + 1);
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const accountId = value.slice(0, dot);
  const given = value.slice(dot + 1);
  const expected = sign(accountId);
  if (given.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? accountId : null;
}
