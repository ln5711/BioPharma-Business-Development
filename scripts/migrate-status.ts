/**
 * READ-ONLY migration status. Connects to the resolved database, reads
 * `drizzle.__drizzle_migrations`, and prints which local migrations are already
 * applied and which are pending. Writes nothing.
 *
 *   npm run db:migrate:status
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { env, usingPglite } from "@/lib/env";

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

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

async function main() {
  const journal = JSON.parse(
    readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  // drizzle stores a hash of each migration's SQL text keyed by creation time.
  const local = journal.entries.map((e) => {
    const sql = readFileSync(join(process.cwd(), "drizzle", `${e.tag}.sql`), "utf8");
    return { ...e, hash: createHash("sha256").update(sql).digest("hex") };
  });

  if (usingPglite) {
    console.log("Using PGlite (local dev). Local migrations on disk:");
    for (const e of local) console.log(`  ${String(e.idx).padStart(4, "0")}  ${e.tag}`);
    console.log("\nRun `npm run db:migrate` to apply.");
    return;
  }

  const url = unpooledUrl() ?? env.DATABASE_URL;
  const statusHost = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "unknown-host";
    }
  })();
  const expect = process.env.MIGRATE_EXPECT_HOST?.trim();
  if (expect && !statusHost.startsWith(expect)) {
    throw new Error(
      `Host guard: MIGRATE_EXPECT_HOST="${expect}" but resolved host is "${statusHost}".`,
    );
  }
  const postgres = (await import("postgres")).default;
  const client = postgres(url, { max: 1 });

  let applied: { hash: string; created_at: string }[] = [];
  try {
    applied = await client<{ hash: string; created_at: string }[]>`
      select hash, created_at from drizzle.__drizzle_migrations order by created_at asc
    `;
  } catch {
    console.log("No drizzle.__drizzle_migrations table yet — the database has no migrations applied.");
  }
  const appliedHashes = new Set(applied.map((a) => a.hash));

  console.log(`Database: ${new URL(url).host}\n`);
  let pending = 0;
  for (const e of local) {
    const isApplied = appliedHashes.has(e.hash);
    if (!isApplied) pending += 1;
    console.log(`  [${isApplied ? "x" : " "}] ${String(e.idx).padStart(4, "0")}  ${e.tag}`);
  }
  console.log(
    pending === 0
      ? "\n✔ Up to date — nothing to apply."
      : `\n${pending} migration(s) pending. Apply with: npm run db:migrate`,
  );

  await client.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
