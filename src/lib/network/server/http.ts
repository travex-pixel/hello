import "server-only";
import type { Account } from "../types";
import { authForRequest, type AuthIdentity, type AuthSession } from "./auth";
import { getStore } from "./backend";
import { humanModeEnabled } from "./config";
import { ServiceError } from "./service";

export interface PeopleHelpers {
  auth: AuthSession;
  identity(): Promise<AuthIdentity | null>;
  /** The signed-in, joined, unsuspended member making this request. */
  member(): Promise<Account>;
  ip: string;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

/** Rejects state-changing requests sent from another site. Cookies are SameSite=Lax too. */
function crossSite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return true;
  }
}

/** Wraps a handler with the feature gate, identity, consistent errors and session cookies. */
export function peopleRoute<Ctx>(handler: (request: Request, ctx: Ctx, h: PeopleHelpers) => Promise<Response>, opts: { allowWhenDisabled?: boolean } = {}) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    if (!opts.allowWhenDisabled && !humanModeEnabled()) return Response.json({ enabled: false, error: "human_mode_disabled" }, { status: 503 });
    if (crossSite(request)) return Response.json({ error: "bad_origin" }, { status: 403 });
    const auth = authForRequest(request);
    const h: PeopleHelpers = {
      auth,
      ip: clientIp(request),
      identity: () => auth.identity(),
      async member() {
        const identity = await auth.identity();
        if (!identity) throw new ServiceError("not_signed_in", 401);
        const account = await getStore().getAccountByAuthUser(identity.userId);
        if (!account) throw new ServiceError("not_joined", 403);
        if (account.suspended) throw new ServiceError("suspended", 403);
        return account;
      },
    };
    let response: Response;
    try {
      response = await handler(request, ctx, h);
    } catch (err) {
      if (err instanceof ServiceError) response = Response.json({ error: err.code }, { status: err.status });
      else {
        // Log the failure without request bodies, emails or message text.
        console.error("[hello] people route failed:", err instanceof Error ? err.message : "unknown error");
        response = Response.json({ error: "internal" }, { status: 500 });
      }
    }
    response.headers.set("cache-control", "no-store");
    return auth.apply(response);
  };
}
