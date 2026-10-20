import "server-only";
import { Pool, type PoolClient } from "pg";

/**
 * The smallest database surface the store needs. Implemented by node-postgres
 * in the app and by PGlite (Postgres compiled to WASM) in tests, so the same
 * SQL is exercised in both.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Runs several statements with no parameters (migrations). */
  exec(text: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

function clientDb(client: PoolClient): Db {
  return {
    query: async <T,>(text: string, params?: unknown[]) => ({ rows: (await client.query(text, params as unknown[])).rows as T[] }),
    exec: async (text) => {
      await client.query(text);
    },
    transaction: (fn) => fn(clientDb(client)),
  };
}

/**
 * TLS for remote databases. Always encrypted. With DATABASE_CA_CERT (the CA
 * certificate Supabase offers under Database settings) the server is also
 * verified; without it the connection is encrypted but not verified.
 * Local databases (localhost) connect without TLS.
 */
function tlsFor(connectionString: string) {
  const url = new URL(connectionString);
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return { url: connectionString, ssl: undefined };
  // sslmode in the URL would override these settings, so it's removed here.
  url.searchParams.delete("sslmode");
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  return { url: url.toString(), ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } };
}

export function pgDb(connectionString: string): Db {
  const { url, ssl } = tlsFor(connectionString);
  // Small pool: serverless instances are many and short-lived, and Supabase's
  // pooler (transaction mode) multiplexes connections behind it.
  const pool = new Pool({ connectionString: url, ssl, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  return {
    query: async <T,>(text: string, params?: unknown[]) => ({ rows: (await pool.query(text, params as unknown[])).rows as T[] }),
    exec: async (text) => {
      await pool.query(text);
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(clientDb(client));
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
