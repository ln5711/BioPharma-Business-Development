import type { PgliteDatabase } from "drizzle-orm/pglite";
import { env, usingPglite } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * Driver selection.
 *
 *  • DATABASE_URL set  → Postgres via postgres-js (production / staging / CI).
 *  • DATABASE_URL empty → embedded PGlite at PGLITE_DATA_DIR — LOCAL DEV ONLY.
 *
 * PGlite is real Postgres (WASM), so the schema, SQL migrations and query
 * builder are identical across both drivers. We expose the PGlite database type
 * as the common surface — the postgres-js instance satisfies the same query API.
 *
 * ── Why PGlite is dev-only ────────────────────────────────────────────────────
 * PGlite persists to a directory on disk. Serverless / edge hosts (Vercel,
 * Lambda, Cloud Run, …) give a function an ephemeral, mostly read-only
 * filesystem, so PGlite there would (a) fail to write during the build's
 * "Collecting page data" phase and (b) hand every request a brand-new empty
 * database. On those hosts DATABASE_URL is mandatory. `createDb()` refuses to
 * fall back to PGlite when it detects a managed host (or REQUIRE_POSTGRES=1),
 * and throws an actionable error instead of a cryptic PGlite fs failure.
 *
 * ── Build-time safety ────────────────────────────────────────────────────────
 * The connection is created lazily on first getDb() call — never at import time.
 * `next build` loads every route module to collect its config; because no
 * module-scope code calls getDb(), and every DB-backed page is `force-dynamic`,
 * the database is never contacted during the build.
 */
export type DrizzleDb = PgliteDatabase<typeof schema>;

/** True on managed hosts where a persistent local filesystem does not exist. */
const MANAGED_HOST =
  !!process.env.VERCEL ||
  !!process.env.NETLIFY ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  !!process.env.K_SERVICE || // Cloud Run / Knative
  process.env.REQUIRE_POSTGRES === "1";

function missingDatabaseUrlError(): Error {
  return new Error(
    [
      "DATABASE_URL is not set.",
      "",
      "This deployment target has no persistent writable filesystem, so the",
      "embedded PGlite database cannot be used. Set DATABASE_URL to a Postgres",
      "connection string — e.g. Vercel Postgres, Neon, Supabase, or RDS:",
      "",
      "  DATABASE_URL=postgres://user:password@host:5432/dbname",
      "",
      "Then run migrations against it: `npm run db:migrate` (with DATABASE_URL",
      "in the environment). PGlite (DATABASE_URL unset) is for local dev only.",
    ].join("\n"),
  );
}

async function createDb(): Promise<DrizzleDb> {
  if (usingPglite) {
    if (MANAGED_HOST) throw missingDatabaseUrlError();

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
  closers.push(() => client.end({ timeout: 5 }));
  return drizzle(client, { schema }) as unknown as DrizzleDb;
}

const globalForDb = globalThis as unknown as { __db?: Promise<DrizzleDb> };
const closers: (() => Promise<unknown> | unknown)[] = [];

/**
 * Close the underlying connection pool. For scripts / tests only — a long-lived
 * server never calls this. Lets a Node process exit cleanly instead of hanging
 * on an open pool (and without a `process.exit` that could mask a failure).
 */
export async function closeDb(): Promise<void> {
  const fns = closers.splice(0);
  globalForDb.__db = undefined;
  await Promise.allSettled(fns.map((f) => f()));
}

/**
 * Convenience accessor: `const db = await getDb()`.
 * The connection is created lazily on first call (never at import time — that
 * would try to boot a driver during `next build` page-data collection) and
 * cached across HMR reloads in dev. A failed attempt is not cached, so a
 * transient error (or a late-arriving DATABASE_URL) can recover on the next call.
 */
export function getDb(): Promise<DrizzleDb> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb().catch((err) => {
      globalForDb.__db = undefined;
      throw err;
    });
  }
  return globalForDb.__db;
}

export { schema };
