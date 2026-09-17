import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { llmStatus } from "@/lib/llm/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Non-sensitive deployment health probe. NEVER returns secret values — only
 * booleans, the provider name, the model id (a config value), and the DB host.
 * On Production it returns a bare `{ ok: true }`; the detail is only exposed on
 * Preview / non-production so a preview can be verified without a login.
 */
export async function GET() {
  const isPreview =
    process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
  if (!isPreview) return NextResponse.json({ ok: true });

  const status = llmStatus();

  let dbReachable = false;
  let dbHost: string | null = null;
  let migrationsApplied: string[] = [];
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    dbReachable = true;
    try {
      const rows = (await db.execute(
        sql`select hash from drizzle.__drizzle_migrations order by created_at asc`,
      )) as unknown as { rows?: { hash: string }[] } | { hash: string }[];
      const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
      migrationsApplied = list.map((r) => r.hash.slice(0, 12));
    } catch {
      /* table may not exist yet */
    }
  } catch {
    dbReachable = false;
  }
  try {
    dbHost = new URL(process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL ?? "").host || null;
  } catch {
    dbHost = null;
  }

  return NextResponse.json({
    ok: true,
    env: process.env.VERCEL_ENV ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    auth: { secretConfigured: Boolean(process.env.AUTH_SECRET) },
    llm: {
      provider: status.provider,
      model: status.model,
      configured: status.configured,
      webSearch: status.webSearch,
      reason: status.reason ?? null,
    },
    db: { reachable: dbReachable, host: dbHost, migrationCount: migrationsApplied.length },
  });
}
