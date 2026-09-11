/**
 * One-time baseline for a Neon **schema-only** branch.
 *
 * A schema-only branch copies the parent's tables but not the rows of
 * `drizzle.__drizzle_migrations`, so the migrator would try to re-create tables
 * that already exist. This script records migrations whose EFFECTS are already
 * present in the schema — after VERIFYING that against the live schema — so a
 * subsequent `npm run db:migrate` only applies the genuinely-missing ones.
 *
 * Safety:
 *  - Aborts unless `__drizzle_migrations` is empty (never clobbers real history).
 *  - Aborts unless the schema actually matches the baseline it is about to record
 *    (baseline table present AND the next migration's columns absent).
 *  - Inserts only history rows. No DDL, no data.
 *  - Idempotent: re-running is a no-op once rows exist.
 *
 *   DOTENV_CONFIG_PATH=.env.preview.local npx tsx scripts/baseline-migrations.ts
 *   # add --apply to write; default is a dry run
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");

/** Migrations to treat as the baseline (their DDL is already in the branch). */
const BASELINE_TAGS = ["0000_furry_jane_foster", "0001_swift_silvermane", "0002_fair_loners"];
/** The first migration that must NOT yet be present (proves baseline == 0002). */
const NEXT_TAG = "0003_mushy_sister_grimm";

async function main() {
  const url =
    process.env.MIGRATE_DATABASE_URL ||
    process.env.STORAGE_DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.STORAGE_DATABASE_URL ||
    "";
  if (!url) throw new Error("no direct database URL in environment");
  const host = new URL(url).host;
  console.log(`target: ${host}${APPLY ? "  [APPLY]" : "  [dry run]"}\n`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    // ── guard 1: history must be empty ───────────────────────────────────
    const hist = await sql<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    if (hist[0].n !== 0) {
      throw new Error(
        `drizzle.__drizzle_migrations already has ${hist[0].n} row(s) — refusing to touch a non-empty history. Run 'npm run db:migrate:status' instead.`,
      );
    }

    // ── guard 2: schema must actually be at the 0002 baseline ────────────
    const baselinePresent = await colOrTable(sql, "tenants", "id");
    const nextAbsent = !(await colOrTable(sql, "user_preferences", "theme"));
    if (!baselinePresent) {
      throw new Error("baseline table 'tenants' is missing — this is not a 0002-state branch. Aborting.");
    }
    if (!nextAbsent) {
      throw new Error(
        "user_preferences.theme already exists — schema is past 0002. Do NOT baseline; investigate manually.",
      );
    }
    console.log("verified: schema is exactly at the 0000-0002 baseline (tenants present, 0003 columns absent)\n");

    // ── record the baseline rows ────────────────────────────────────────
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string; when: number }[] };

    for (const tag of BASELINE_TAGS) {
      const entry = journal.entries.find((e) => e.tag === tag);
      if (!entry) throw new Error(`journal has no entry for ${tag}`);
      const body = readFileSync(join(process.cwd(), "drizzle", `${tag}.sql`), "utf8");
      const hash = createHash("sha256").update(body).digest("hex");
      console.log(`  record ${tag}  when=${entry.when}  hash=${hash.slice(0, 16)}…`);
      if (APPLY) {
        await sql`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          values (${hash}, ${entry.when})`;
      }
    }

    // sanity: NEXT_TAG must be strictly after the recorded max
    const nextEntry = journal.entries.find((e) => e.tag === NEXT_TAG)!;
    const maxRecorded = Math.max(
      ...BASELINE_TAGS.map((t) => journal.entries.find((e) => e.tag === t)!.when),
    );
    console.log(
      `\nnext migration ${NEXT_TAG} when=${nextEntry.when} > baseline max ${maxRecorded}: ${
        nextEntry.when > maxRecorded ? "OK ✅" : "PROBLEM ❌"
      }`,
    );

    console.log(
      APPLY
        ? "\n✔ baseline recorded. Now run: npm run db:migrate  (applies 0003-0006 only)"
        : "\n(dry run — re-run with --apply to write the 3 baseline rows)",
    );
  } finally {
    await sql.end();
  }
}

async function colOrTable(sql: any, table: string, col: string): Promise<boolean> {
  const r = await sql`
    select 1 from information_schema.columns
    where table_schema='public' and table_name=${table} and column_name=${col} limit 1`;
  return r.length > 0;
}

main().catch((e) => {
  console.error("\n✖", (e as Error).message);
  process.exit(1);
});
