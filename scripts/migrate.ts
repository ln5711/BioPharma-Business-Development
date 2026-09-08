/**
 * Applies the generated SQL migrations in ./drizzle to whichever database the
 * environment points at. Run with: `npm run db:migrate`.
 */
import "dotenv/config";
import { env, usingPglite } from "@/lib/env";

async function main() {
  const folder = "./drizzle";

  if (usingPglite) {
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

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: folder });
  await client.end();
  console.log("✔ migrations applied to Postgres");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
