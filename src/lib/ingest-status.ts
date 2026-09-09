import "server-only";
import { and, desc, eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import { jobRuns, watchlists } from "@/db/schema";

export type IngestState =
  | "not_configured" // no watchlist → nothing to sync
  | "never" // configured but never run
  | "syncing" // a run is in progress
  | "ok" // last run succeeded
  | "failed"; // last run errored

export interface IngestStatus {
  state: IngestState;
  /** finishedAt of the last completed run (ok/failed), or startedAt if syncing. */
  at: Date | null;
  detail: string | null;
}

/**
 * Real ClinicalTrials.gov ingestion status for a tenant, derived from
 * `job_runs` (written by `ingestWatchlist`). No timers, no hard-coded "Live".
 */
export async function getIngestStatus(tenantId: string): Promise<IngestStatus> {
  const db = await getDb();

  const [wl] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(eq(watchlists.tenantId, tenantId))
    .limit(1);
  if (!wl) return { state: "not_configured", at: null, detail: null };

  const [run] = await db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.tenantId, tenantId), like(jobRuns.jobName, "ctgov:%")))
    .orderBy(desc(jobRuns.startedAt))
    .limit(1);

  if (!run) return { state: "never", at: null, detail: null };

  if (run.status === "running") {
    return { state: "syncing", at: run.startedAt, detail: null };
  }
  if (run.status === "error") {
    return { state: "failed", at: run.finishedAt ?? run.startedAt, detail: run.error ?? null };
  }
  const s = run.stats ?? {};
  const changed = Number(s.newTrials ?? 0) + Number(s.updatedTrials ?? 0);
  return {
    state: "ok",
    at: run.finishedAt ?? run.startedAt,
    detail: changed > 0 ? `${changed} trial update${changed === 1 ? "" : "s"}` : "no changes",
  };
}
