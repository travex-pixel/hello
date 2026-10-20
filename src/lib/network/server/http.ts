import "server-only";
import { humanModeEnabled } from "./config";
import { readSession } from "./session";
import { ServiceError } from "./service";

export function disabledResponse() {
  return Response.json({ enabled: false, error: "human_mode_disabled" }, { status: 503 });
}

export function requireAccount(request: Request): string | Response {
  const accountId = readSession(request);
  if (!accountId) return Response.json({ error: "not_joined" }, { status: 401 });
  return accountId;
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

/** Wraps a handler with the human-mode gate and consistent error shapes. */
export function peopleRoute<Ctx>(handler: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    if (!humanModeEnabled()) return disabledResponse();
    try {
      return await handler(request, ctx);
    } catch (err) {
      if (err instanceof ServiceError) return Response.json({ error: err.code }, { status: err.status });
      console.error("[hello] people route failed", err);
      return Response.json({ error: "internal" }, { status: 500 });
    }
  };
}
