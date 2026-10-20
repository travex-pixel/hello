import "server-only";
import type { DiscoveryScope } from "../types";

export type HumanBackend = "none" | "memory" | "supabase";

export interface HumanConfig {
  backend: HumanBackend;
  /** Why real-people mode is off, for the status endpoint and logs. Never contains secrets. */
  reason?: "disabled" | "not_configured" | "memory_not_allowed_in_production";
  scope: DiscoveryScope;
}

const SUPABASE_VARS = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/**
 * HELLO_HUMAN_MODE:
 *   "supabase" persistent Postgres + Supabase email sign-in (the beta)
 *   "memory"   single-process store with throwaway identities (local only)
 *   anything else: off
 */
export function humanConfig(): HumanConfig {
  const scope: DiscoveryScope = process.env.HELLO_DISCOVERY === "friends_of_friends" ? "friends_of_friends" : "community";
  const mode = process.env.HELLO_HUMAN_MODE;
  if (mode === "supabase") {
    const missing = SUPABASE_VARS.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn(`[hello] HELLO_HUMAN_MODE=supabase but missing: ${missing.join(", ")}. Real-people mode is off.`);
      return { backend: "none", reason: "not_configured", scope };
    }
    return { backend: "supabase", scope };
  }
  if (mode === "memory") {
    if (process.env.VERCEL_ENV === "production") return { backend: "none", reason: "memory_not_allowed_in_production", scope };
    return { backend: "memory", scope };
  }
  return { backend: "none", reason: "disabled", scope };
}

export function humanModeEnabled(): boolean {
  return humanConfig().backend !== "none";
}
