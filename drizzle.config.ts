import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit only generates SQL here; migrations are APPLIED by
 * `scripts/migrate.ts`, which understands both the Postgres and PGlite drivers.
 * When DATABASE_URL is set, `npm run db:studio` / `db:push` also work directly.
 */
const url = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url ? { dbCredentials: { url } } : { driver: "pglite" as never }),
  strict: true,
  verbose: true,
});
