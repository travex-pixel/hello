import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerClient, parseCookieHeader, serializeCookieHeader, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { humanConfig } from "./config";

export interface AuthIdentity {
  /** Stable id from the auth provider. */
  userId: string;
  /** True only when the provider verified ownership of the email address. */
  emailVerified: boolean;
}

export type CodeResult = { ok: true } | { ok: false; error: "invalid_email" | "invalid_code" | "rate_limited" | "unavailable" };

/**
 * Identity for one request. "supabase" uses Supabase Auth email one-time
 * codes with HttpOnly session cookies; "dev" mints a throwaway signed
 * identity and exists only for the local memory mode.
 */
export interface AuthSession {
  kind: "supabase" | "dev";
  identity(): Promise<AuthIdentity | null>;
  sendCode(email: string): Promise<CodeResult>;
  verifyCode(email: string, code: string): Promise<CodeResult & { identity?: AuthIdentity }>;
  /** Dev only: create an identity for someone joining without email. */
  mintDevIdentity(): AuthIdentity;
  signOut(): Promise<void>;
  /** Removes the person from the auth provider (their email address). */
  deleteUser(userId: string): Promise<boolean>;
  /** Writes any cookies the session changed onto the response. */
  apply(response: Response): Response;
}

const SESSION_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

function supabaseSession(request: Request): AuthSession {
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get("cookie") ?? "").map((c) => ({ name: c.name, value: c.value ?? "" })),
      setAll: (list) => {
        pending.push(...list.map((c) => ({ name: c.name, value: c.value, options: { ...c.options, ...SESSION_COOKIE_OPTIONS } })));
      },
    },
    cookieOptions: SESSION_COOKIE_OPTIONS,
  });

  let cached: Promise<AuthIdentity | null> | null = null;
  const toIdentity = (user: { id: string; email_confirmed_at?: string | null } | null) =>
    user ? { userId: user.id, emailVerified: !!user.email_confirmed_at } : null;

  return {
    kind: "supabase",
    identity() {
      // getUser() asks the auth server, so a forged or revoked token is rejected.
      cached ??= client.auth.getUser().then(({ data, error }) => (error ? null : toIdentity(data.user)));
      return cached;
    },
    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (!error) return { ok: true };
      if (error.status === 429) return { ok: false, error: "rate_limited" };
      if (error.status === 400 || error.status === 422) return { ok: false, error: "invalid_email" };
      return { ok: false, error: "unavailable" };
    },
    async verifyCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
      if (error || !data.user) return { ok: false, error: error?.status === 429 ? "rate_limited" : "invalid_code" };
      const identity = toIdentity(data.user)!;
      cached = Promise.resolve(identity);
      return { ok: true, identity };
    },
    mintDevIdentity() {
      throw new Error("dev identities are not available with Supabase auth");
    },
    async signOut() {
      await client.auth.signOut();
    },
    async deleteUser(userId) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await admin.auth.admin.deleteUser(userId);
      return !error;
    },
    apply(response) {
      for (const c of pending) response.headers.append("set-cookie", serializeCookieHeader(c.name, c.value, c.options));
      return response;
    },
  };
}

const DEV_COOKIE = "hello_dev_identity";

declare global {
  var __helloDevSecret: string | undefined;
}

function devSecret() {
  globalThis.__helloDevSecret ??= randomBytes(32).toString("hex");
  return globalThis.__helloDevSecret;
}

const devSign = (id: string) => createHmac("sha256", devSecret()).update(id).digest("hex").slice(0, 40);

function devSession(request: Request): AuthSession {
  const pending: string[] = [];
  return {
    kind: "dev",
    async identity() {
      const raw = parseCookieHeader(request.headers.get("cookie") ?? "").find((c) => c.name === DEV_COOKIE)?.value;
      if (!raw) return null;
      const dot = raw.lastIndexOf(".");
      const id = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      const expected = devSign(id);
      if (dot <= 0 || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
      return { userId: id, emailVerified: false };
    },
    async sendCode() {
      return { ok: false, error: "unavailable" };
    },
    async verifyCode() {
      return { ok: false, error: "unavailable" };
    },
    mintDevIdentity() {
      const id = `dev_${randomBytes(9).toString("hex")}`;
      pending.push(serializeCookieHeader(DEV_COOKIE, `${id}.${devSign(id)}`, { ...SESSION_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 30 }));
      return { userId: id, emailVerified: false };
    },
    async signOut() {
      pending.push(serializeCookieHeader(DEV_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 }));
    },
    async deleteUser() {
      return true;
    },
    apply(response) {
      for (const c of pending) response.headers.append("set-cookie", c);
      return response;
    },
  };
}

export function authForRequest(request: Request): AuthSession {
  return humanConfig().backend === "supabase" ? supabaseSession(request) : devSession(request);
}
