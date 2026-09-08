import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, watchlists } from "@/db/schema";
import { env } from "@/lib/env";
import { ingestWatchlist } from "@/integrations/clinicaltrials/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Background ingestion endpoint (spec §59 / §60). Trigger from cron / a queue:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/cron/ctgov
 * Idempotent and safe to run daily after the upstream ClinicalTrials.gov refresh.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const allTenants = await db.select().from(tenants).orderBy(asc(tenants.createdAt));
  const results: Record<string, unknown>[] = [];

  for (const tenant of allTenants) {
    const lists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.tenantId, tenant.id));
    for (const wl of lists) {
      try {
        const stats = await ingestWatchlist(db, {
          tenantId: tenant.id,
          watchlistId: wl.id,
          maxStudies: 300,
        });
        results.push({ tenant: tenant.slug, watchlist: wl.name, stats });
      } catch (err) {
        results.push({
          tenant: tenant.slug,
          watchlist: wl.name,
          error: (err as Error).message,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
