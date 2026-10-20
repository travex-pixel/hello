import "server-only";
import { humanConfig } from "./config";
import { pgDb } from "./db";
import { PostgresNetworkStore } from "./pg-store";
import { MemoryNetworkStore, type NetworkStore } from "./store";

declare global {
  var __helloNetworkStore: NetworkStore | undefined;
}

/** One store per server process (survives hot reloads in development). */
export function getStore(): NetworkStore {
  if (globalThis.__helloNetworkStore) return globalThis.__helloNetworkStore;
  const { backend } = humanConfig();
  const store = backend === "supabase" ? new PostgresNetworkStore(pgDb(process.env.DATABASE_URL!)) : new MemoryNetworkStore();
  globalThis.__helloNetworkStore = store;
  // Local memory mode only: a fixed code so the first person can join.
  if (backend === "memory" && process.env.HELLO_FOUNDER_INVITE) {
    const now = Date.now();
    void store.saveInvitation({ code: process.env.HELLO_FOUNDER_INVITE.toUpperCase(), inviterId: null, createdAt: now, expiresAt: now + 14 * 86_400_000, maxUses: 20, redeemedBy: [], revoked: false });
  }
  return store;
}

/** Test hook. */
export function setStoreForTests(store: NetworkStore | undefined) {
  globalThis.__helloNetworkStore = store;
}
