import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobRuns, tenants, watchlists } from "@/db/schema";
import { env } from "@/lib/env";
import { ingestWatchlist } from "@/integrations/clinicaltrials/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled ClinicalTrials.gov ingestion.
 *
 * Vercel Cron calls this with `GET` and `Authorization: Bearer $CRON_SECRET`
 * (see `vercel.json`). A manual trigger may also use `POST` with either that
 * header or `x-cron-secret: $CRON_SECRET`:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/ctgov
 *
 * Fails closed if CRON_SECRET is unset / the dev default in production. Bounded
 * per run, idempotent (ingestWatchlist dedupes), and the response reports
 * partial failures instead of a blanket `ok: true`.
 */
const DEV_CRON_SECRET = "dev-only-change-me";
const PER_RUN_STUDY_CAP = 300;

function authorized(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret === DEV_CRON_SECRET)) {
    return false; // fail closed — no usable secret configured
  }
  const bearer = req.headers.get("authorization");
  if (bearer && bearer === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const [overall] = await db
    .insert(jobRuns)
    .values({ jobName: "ctgov:cron", status: "running" })
    .returning({ id: jobRuns.id });

  const allTenants = await db.select().from(tenants).orderBy(asc(tenants.createdAt));
  const results: Record<string, unknown>[] = [];
  let watchlistsRun = 0;
  let failures = 0;

  for (const tenant of allTenants) {
    const lists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.tenantId, tenant.id));
    for (const wl of lists) {
      watchlistsRun += 1;
      try {
        const stats = await ingestWatchlist(db, {
          tenantId: tenant.id,
          watchlistId: wl.id,
          maxStudies: PER_RUN_STUDY_CAP,
        });
        results.push({ tenant: tenant.slug, watchlist: wl.name, stats });
      } catch (err) {
        failures += 1;
        results.push({
          tenant: tenant.slug,
          watchlist: wl.name,
          error: (err as Error).message,
        });
      }
    }
  }

  const ok = failures === 0;
  await db
    .update(jobRuns)
    .set({
      status: ok ? "success" : "error",
      finishedAt: new Date(),
      error: ok ? null : `${failures}/${watchlistsRun} watchlist runs failed`,
      stats: { watchlistsRun, failures },
    })
    .where(eq(jobRuns.id, overall.id));

  return NextResponse.json(
    { ok, ranAt: new Date().toISOString(), watchlistsRun, failures, results },
    { status: ok ? 200 : 207 },
  );
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
