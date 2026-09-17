/**
 * Applies the generated SQL migrations in ./drizzle to whichever database the
 * environment points at. Run with: `npm run db:migrate`.
 *
 * Safety:
 *  • Only ever RUNS FORWARD. drizzle's migrator records applied migrations in
 *    `drizzle.__drizzle_migrations` and skips anything already there — it never
 *    drops, resets or re-runs. No seeding happens here.
 *  • Prefers a DIRECT (unpooled) connection. drizzle's migrator takes a Postgres
 *    advisory lock, which PgBouncer in transaction mode (Neon's pooled endpoint)
 *    does not support. Set STORAGE_DATABASE_URL_UNPOOLED / DATABASE_URL_UNPOOLED
 *    / POSTGRES_URL_NON_POOLING and it will be used automatically.
 */
import "dotenv/config";
import { env, usingPglite } from "@/lib/env";

/** Direct/unpooled connection string, if the environment exposes one. */
function unpooledUrl(): string | null {
  const candidates = [
    process.env.MIGRATE_DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.STORAGE_DATABASE_URL_UNPOOLED,
    process.env.STORAGE_POSTGRES_URL_NON_POOLING,
  ];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  return null;
}

async function main() {
  const folder = "./drizzle";

  // An explicit direct-connection override (e.g. MIGRATE_DATABASE_URL pointing
  // at a Neon preview branch) always wins, even if no STORAGE_DATABASE_URL is
  // set for the app runtime.
  const override = unpooledUrl();

  if (usingPglite && !override) {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(env.PGLITE_DATA_DIR);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    await client.close();
    console.log(`✔ migrations applied to PGlite (${env.PGLITE_DATA_DIR})`);
    return;
  }

  const direct = override;
  const url = direct ?? env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL resolved. Set STORAGE_DATABASE_URL (or DATABASE_URL / POSTGRES_URL).",
    );
  }
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "unknown-host";
    }
  })();

  // Safety rail: when MIGRATE_EXPECT_HOST is set, refuse to run unless the
  // resolved host matches it. Use this for production
  //   MIGRATE_EXPECT_HOST=ep-polished-boat-aru8on3x DOTENV_CONFIG_PATH=.env.production.local npm run db:migrate
  const expect = process.env.MIGRATE_EXPECT_HOST?.trim();
  if (expect && !host.startsWith(expect)) {
    throw new Error(
      `Refusing to migrate: MIGRATE_EXPECT_HOST="${expect}" but the resolved host is "${host}". ` +
        `Check DOTENV_CONFIG_PATH / the connection string.`,
    );
  }

  console.log(
    `→ applying migrations to ${host} via ${direct ? "DIRECT (unpooled)" : "the resolved (possibly pooled)"} connection` +
      (expect ? ` [host guard: ${expect} ✓]` : ""),
  );

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: folder });
  await client.end();
  console.log("✔ migrations applied to Postgres (forward-only; nothing dropped or seeded)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
