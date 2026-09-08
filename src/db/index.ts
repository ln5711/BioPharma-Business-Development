import type { PgliteDatabase } from "drizzle-orm/pglite";
import { env, usingPglite } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * Driver selection.
 *
 *  • DATABASE_URL set  → Postgres via postgres-js (production / staging).
 *  • DATABASE_URL empty → embedded PGlite written to PGLITE_DATA_DIR so the
 *    whole platform runs with zero external services (spec §115 — build the
 *    interface, degrade gracefully, keep building).
 *
 * PGlite is real Postgres (WASM), so the schema, SQL migrations and query
 * builder are identical across both drivers. We expose the PGlite database type
 * as the common surface — the postgres-js instance satisfies the same query API.
 */
export type DrizzleDb = PgliteDatabase<typeof schema>;

async function createDb(): Promise<DrizzleDb> {
  if (usingPglite) {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { PGlite } = await import("@electric-sql/pglite");
    const { resolve, isAbsolute } = await import("node:path");
    // PGlite's fs loader resolves a relative dir against a bundled module URL
    // and hands `fs` a non-file URL — always pass an absolute path.
    const dir = isAbsolute(env.PGLITE_DATA_DIR)
      ? env.PGLITE_DATA_DIR
      : resolve(process.cwd(), env.PGLITE_DATA_DIR);
    const client = new PGlite(dir);
    return drizzle(client, { schema });
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const client = postgres(env.DATABASE_URL, { max: 10 });
  return drizzle(client, { schema }) as unknown as DrizzleDb;
}

const globalForDb = globalThis as unknown as { __db?: Promise<DrizzleDb> };

/**
 * Convenience accessor: `const db = await getDb()`.
 * The connection is created lazily on first call (never at import time — that
 * would try to boot PGlite during `next build` page-data collection) and cached
 * across HMR reloads in dev.
 */
export function getDb(): Promise<DrizzleDb> {
  return (globalForDb.__db ??= createDb());
}

export { schema };
