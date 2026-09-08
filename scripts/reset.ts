/**
 * Drops every table and re-applies migrations. Destructive — dev only.
 * `npm run db:reset`
 */
import "dotenv/config";
import { env, usingPglite } from "@/lib/env";

const DROP_ALL = `
DROP SCHEMA IF EXISTS drizzle CASCADE;
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;
`;

async function main() {
  if (usingPglite) {
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(env.PGLITE_DATA_DIR);
    await client.exec(DROP_ALL);
    await client.close();
  } else {
    const postgres = (await import("postgres")).default;
    const client = postgres(env.DATABASE_URL, { max: 1 });
    await client.unsafe(DROP_ALL);
    await client.end();
  }
  console.log("✔ schema dropped — run `npm run db:migrate` next");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
