import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "@/lib/network/server/db";

/** Postgres compiled to WASM: the real SQL engine, in-process, for tests. */
export function pgliteDb(): Db {
  const pg = new PGlite();
  const wrap = (q: PGlite | Transaction): Db => ({
    query: async <T,>(text: string, params?: unknown[]) => ({ rows: (await q.query<T>(text, params as unknown[])).rows }),
    exec: async (text) => {
      await q.exec(text);
    },
    transaction: (fn) => ("transaction" in q ? (q as PGlite).transaction((tx) => fn(wrap(tx))) : fn(wrap(q))),
  });
  return wrap(pg);
}
