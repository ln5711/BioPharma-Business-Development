/**
 * READ-ONLY post-migration schema check. Confirms every schema object the code
 * on `harden/identity-session-themes-priorities` depends on (migrations
 * 0003–0008) exists in the resolved database. Writes nothing; mutates nothing.
 *
 *   MIGRATE_EXPECT_HOST=ep-polished-boat-aru8on3x \
 *   DOTENV_CONFIG_PATH=.env.production.local \
 *   npx tsx scripts/verify-prod-schema.ts
 */
import "dotenv/config";
import { env } from "@/lib/env";

function unpooledUrl(): string | null {
  const c = [
    process.env.MIGRATE_DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.STORAGE_DATABASE_URL_UNPOOLED,
    process.env.STORAGE_POSTGRES_URL_NON_POOLING,
  ];
  for (const v of c) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

async function main() {
  const url = unpooledUrl() ?? env.DATABASE_URL;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "unknown-host";
    }
  })();
  const expect = process.env.MIGRATE_EXPECT_HOST?.trim();
  if (expect && !host.startsWith(expect)) {
    throw new Error(`Host guard: MIGRATE_EXPECT_HOST="${expect}" but resolved host is "${host}".`);
  }
  console.log(`Database: ${host}\n`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1 });

  const checks: { label: string; ok: boolean; detail: string }[] = [];
  const col = async (table: string, column: string) => {
    const r = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.columns
      where table_schema='public' and table_name=${table} and column_name=${column}`;
    return r[0].n > 0;
  };
  const tbl = async (table: string) => {
    const r = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.tables
      where table_schema='public' and table_name=${table}`;
    return r[0].n > 0;
  };
  const enumHas = async (typ: string, value: string) => {
    const r = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname=${typ} and e.enumlabel=${value}`;
    return r[0].n > 0;
  };

  try {
    // 0003
    checks.push({ label: "0003 user_preferences.theme", ok: await col("user_preferences", "theme"), detail: "column" });
    checks.push({ label: "0003 users.sessions_revoked_at", ok: await col("users", "sessions_revoked_at"), detail: "column" });
    // 0004
    checks.push({ label: "0004 tasks.due_at", ok: await col("tasks", "due_at"), detail: "column" });
    checks.push({ label: "0004 tasks.dedupe_key", ok: await col("tasks", "dedupe_key"), detail: "column" });
    checks.push({ label: "0004 tasks.source", ok: await col("tasks", "source"), detail: "column" });
    // 0005
    checks.push({ label: "0005 trials.first_posted_date", ok: await col("trials", "first_posted_date"), detail: "column" });
    checks.push({ label: "0005 ask_conversations table", ok: await tbl("ask_conversations"), detail: "table" });
    checks.push({ label: "0005 ask_messages table", ok: await tbl("ask_messages"), detail: "table" });
    checks.push({ label: "0005 usage_counters table", ok: await tbl("usage_counters"), detail: "table" });
    // 0006
    checks.push({ label: "0006 outreach_drafts table", ok: await tbl("outreach_drafts"), detail: "table" });
    // 0007
    checks.push({ label: "0007 research_cache table", ok: await tbl("research_cache"), detail: "table" });
    checks.push({ label: "0007 research_cache.payload", ok: await col("research_cache", "payload"), detail: "column" });
    // 0008
    checks.push({
      label: "0008 signal_type enum has TRIAL_MONITORING_STARTED",
      ok: await enumHas("signal_type", "TRIAL_MONITORING_STARTED"),
      detail: "enum value",
    });

    // Row-count sanity (read-only) — proves we can actually query the new objects.
    const [rc] = await sql<{ n: number }[]>`select count(*)::int as n from research_cache`;
    const [en] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='signal_type'`;
    console.log(`(research_cache rows: ${rc.n}; signal_type enum values: ${en.n})\n`);
  } finally {
    await sql.end();
  }

  let failed = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? "✔" : "✗"} ${c.label}  (${c.detail})`);
    if (!c.ok) failed++;
  }
  console.log(
    failed === 0
      ? "\n✔ All required schema objects present — the branch's code is safe to deploy against this database."
      : `\n✗ ${failed} missing — DO NOT deploy the branch until migrations are complete.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
