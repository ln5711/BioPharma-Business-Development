import "server-only";
import { and, desc, eq, gte, ne, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  commercialSignals,
  organizations,
  tasks,
  trialChanges,
  trials,
  watchlists,
} from "@/db/schema";
import { LANDSCAPE_ONLY_SIGNALS } from "@/lib/signals/taxonomy";

/** Bookkeeping signals ("Added to monitoring") never count as new activity. */
const NOT_LANDSCAPE = notInArray(
  commercialSignals.signalType,
  [...LANDSCAPE_ONLY_SIGNALS] as never[],
);

export type SignalRow = typeof commercialSignals.$inferSelect & {
  organizationName: string | null;
  trialNctId: string | null;
};

export async function getTopSignals(
  tenantId: string,
  opts: { limit?: number; minScore?: number } = {},
): Promise<SignalRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      signal: commercialSignals,
      organizationName: organizations.canonicalName,
      trialNctId: trials.nctId,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        NOT_LANDSCAPE,
        opts.minScore
          ? gte(commercialSignals.opportunityScore, opts.minScore)
          : undefined,
      ),
    )
    .orderBy(
      desc(commercialSignals.opportunityScore),
      desc(commercialSignals.detectedAt),
    )
    .limit(opts.limit ?? 25);

  return rows.map((r) => ({
    ...r.signal,
    organizationName: r.organizationName,
    trialNctId: r.trialNctId,
  }));
}

/**
 * Home metric cards — each number is a live count over `sinceMs`, and each is
 * clickable (the Home page maps them to a filtered view).
 */
export async function getDashboardCounts(tenantId: string, sinceMs = 7 * 86_400_000) {
  const db = await getDb();
  const since = new Date(Date.now() - sinceMs);
  const cnt = sql<number>`count(*)::int`;

  const [signals] = await db
    .select({ n: cnt })
    .from(commercialSignals)
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        NOT_LANDSCAPE,
        gte(commercialSignals.detectedAt, since),
      ),
    );

  const [highPriority] = await db
    .select({ n: cnt })
    .from(commercialSignals)
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        NOT_LANDSCAPE,
        gte(commercialSignals.detectedAt, since),
        gte(commercialSignals.opportunityScore, 70),
      ),
    );

  const [changes] = await db
    .select({ n: cnt })
    .from(trialChanges)
    .where(and(eq(trialChanges.tenantId, tenantId), gte(trialChanges.detectedAt, since)));

  const [trialCount] = await db
    .select({ n: cnt })
    .from(trials)
    .where(eq(trials.tenantId, tenantId));

  const [accountsActive] = await db
    .select({ n: sql<number>`count(distinct ${commercialSignals.organizationId})::int` })
    .from(commercialSignals)
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        NOT_LANDSCAPE,
        gte(commercialSignals.detectedAt, since),
      ),
    );

  const [openTasks] = await db
    .select({ n: cnt })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.done, false)));

  return {
    meaningfulSignals: signals?.n ?? 0,
    highPriority: highPriority?.n ?? 0,
    trialChanges: changes?.n ?? 0,
    trialsTracked: trialCount?.n ?? 0,
    accountsActive: accountsActive?.n ?? 0,
    openTasks: openTasks?.n ?? 0,
  };
}

export async function listTrials(tenantId: string, limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(trials)
    .where(eq(trials.tenantId, tenantId))
    .orderBy(desc(trials.lastCtgovUpdate))
    .limit(limit);
}

export async function getTrialByNct(tenantId: string, nctId: string) {
  const db = await getDb();
  const [trial] = await db
    .select()
    .from(trials)
    .where(and(eq(trials.tenantId, tenantId), eq(trials.nctId, nctId)))
    .limit(1);
  if (!trial) return null;

  const changes = await db
    .select()
    .from(trialChanges)
    .where(eq(trialChanges.trialId, trial.id))
    .orderBy(desc(trialChanges.detectedAt))
    .limit(50);

  const signals = await db
    .select()
    .from(commercialSignals)
    .where(eq(commercialSignals.trialId, trial.id))
    .orderBy(desc(commercialSignals.opportunityScore))
    .limit(20);

  return { trial, changes, signals };
}

export async function listAccounts(tenantId: string, limit = 200) {
  const db = await getDb();
  return db
    .select({
      org: organizations,
      trialCount: sql<number>`count(distinct ${trials.id})::int`,
      signalCount: sql<number>`count(distinct ${commercialSignals.id})::int`,
      topScore: sql<number>`coalesce(max(${commercialSignals.opportunityScore}), 0)::int`,
    })
    .from(organizations)
    .leftJoin(trials, eq(trials.sponsorOrganizationId, organizations.id))
    .leftJoin(
      commercialSignals,
      eq(commercialSignals.organizationId, organizations.id),
    )
    .where(eq(organizations.tenantId, tenantId))
    .groupBy(organizations.id)
    .orderBy(desc(sql`coalesce(max(${commercialSignals.opportunityScore}), 0)`))
    .limit(limit);
}

export async function getWatchlists(tenantId: string) {
  const db = await getDb();
  return db
    .select()
    .from(watchlists)
    .where(eq(watchlists.tenantId, tenantId))
    .orderBy(desc(watchlists.createdAt));
}
