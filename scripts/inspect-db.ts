/**
 * READ-ONLY schema + migration-history inspector. Prints structure only — no row
 * data, no credentials. Reads the direct connection from the environment
 * (STORAGE_DATABASE_URL_UNPOOLED / DATABASE_URL_UNPOOLED / MIGRATE_DATABASE_URL).
 *
 *   set -a; . ./.env.preview.local; set +a; npx tsx scripts/inspect-db.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

function directUrl(): string {
  const c = [
    process.env.MIGRATE_DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.STORAGE_DATABASE_URL_UNPOOLED,
    process.env.STORAGE_POSTGRES_URL_NON_POOLING,
    process.env.STORAGE_DATABASE_URL,
    process.env.DATABASE_URL,
  ];
  for (const v of c) if (typeof v === "string" && v.trim()) return v.trim();
  throw new Error("no database URL in environment");
}

async function main() {
  const url = directUrl();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "?";
    }
  })();
  console.log(`target host: ${host}\n`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1, prepare: false });

  // ── public tables ────────────────────────────────────────────────────────
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`;
  console.log(`public tables (${tables.length}):`);
  console.log("  " + tables.map((t) => t.table_name).join(", ") + "\n");

  // ── drizzle migration history ───────────────────────────────────────────
  const histExists = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as exists`;
  if (!histExists[0].exists) {
    console.log("drizzle.__drizzle_migrations: DOES NOT EXIST (clean/empty branch)\n");
  } else {
    const rows = await sql<{ hash: string; created_at: string }[]>`
      select hash, created_at from drizzle.__drizzle_migrations order by created_at asc`;
    console.log(`drizzle.__drizzle_migrations: ${rows.length} row(s)`);
    for (const r of rows) {
      console.log(`  created_at=${r.created_at}  hash=${String(r.hash).slice(0, 16)}…`);
    }
    console.log();
  }

  // ── which migrations' EFFECTS are present in the schema ─────────────────
  const probes: { migration: string; check: () => Promise<boolean>; desc: string }[] = [
    {
      migration: "0000-0002 baseline",
      desc: "table 'tenants' exists",
      check: async () => (await colExists(sql, "tenants", "id")).length > 0,
    },
    {
      migration: "0003",
      desc: "user_preferences.theme + users.sessions_revoked_at",
      check: async () =>
        (await colExists(sql, "user_preferences", "theme")).length > 0 &&
        (await colExists(sql, "users", "sessions_revoked_at")).length > 0,
    },
    {
      migration: "0004",
      desc: "tasks.due_at + tasks.dedupe_key",
      check: async () =>
        (await colExists(sql, "tasks", "due_at")).length > 0 &&
        (await colExists(sql, "tasks", "dedupe_key")).length > 0,
    },
    {
      migration: "0005",
      desc: "ask_conversations table + trials.first_posted_date",
      check: async () =>
        (await tableExists(sql, "ask_conversations")) &&
        (await colExists(sql, "trials", "first_posted_date")).length > 0,
    },
    {
      migration: "0006",
      desc: "outreach_drafts table",
      check: async () => tableExists(sql, "outreach_drafts"),
    },
  ];
  console.log("migration effects present in schema:");
  for (const p of probes) {
    let present = false;
    try {
      present = await p.check();
    } catch {
      present = false;
    }
    console.log(`  ${present ? "✅ PRESENT " : "❌ MISSING "} ${p.migration}  (${p.desc})`);
  }
  console.log();

  // ── the sha256 drizzle expects for each migration file ─────────────────
  const journal = JSON.parse(
    readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: { idx: number; tag: string; when: number }[] };
  console.log("expected (file sha256, journal 'when') per migration:");
  for (const e of journal.entries) {
    const body = readFileSync(join(process.cwd(), "drizzle", `${e.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    console.log(`  ${e.tag}  when=${e.when}  hash=${hash}`);
  }

  await sql.end();
}

async function tableExists(sql: any, name: string): Promise<boolean> {
  const r = await sql`
    select 1 from information_schema.tables
    where table_schema='public' and table_name=${name} limit 1`;
  return r.length > 0;
}
async function colExists(sql: any, table: string, col: string): Promise<any[]> {
  return sql`
    select 1 from information_schema.columns
    where table_schema='public' and table_name=${table} and column_name=${col} limit 1`;
}

main().catch((e) => {
  console.error("inspect failed:", (e as Error).message);
  process.exit(1);
});
