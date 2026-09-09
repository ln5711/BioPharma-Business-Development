import "server-only";
import { and, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  commercialSignals,
  organizations,
  tasks,
  trialChanges,
  trials,
  watchlists,
} from "@/db/schema";

export type SignalRow = typeof commercialSignals.$inferSelect & {
  organizationName: string | null;
  trialNctId: string | null;
};

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function getTopSignals(
  tenantId: string,
  opts: {
    limit?: number;
    minScore?: number;
    company?: string;
    q?: string;
    type?: string;
    sinceDays?: number;
  } = {},
): Promise<{ rows: SignalRow[]; total: number }> {
  const db = await getDb();

  const conds = [
    eq(commercialSignals.tenantId, tenantId),
    ne(commercialSignals.status, "dismissed"),
  ];
  if (opts.minScore) conds.push(gte(commercialSignals.opportunityScore, opts.minScore));
  if (opts.type) conds.push(sql`${commercialSignals.signalType} = ${opts.type}`);
  if (opts.sinceDays) {
    conds.push(
      gte(
        sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`,
        new Date(Date.now() - opts.sinceDays * 86_400_000),
      ),
    );
  }
  if (opts.company) {
    conds.push(ilike(organizations.canonicalName, likeArg(opts.company)));
  }
  if (opts.q) {
    conds.push(
      or(
        ilike(commercialSignals.headline, likeArg(opts.q)),
        ilike(commercialSignals.factSummary, likeArg(opts.q)),
        ilike(organizations.canonicalName, likeArg(opts.q)),
        ilike(trials.nctId, likeArg(opts.q)),
      )!,
    );
  }
  const where = and(...conds);

  const base = db
    .select({
      signal: commercialSignals,
      organizationName: organizations.canonicalName,
      trialNctId: trials.nctId,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(where);

  const [rows, [{ n }]] = await Promise.all([
    base
      .orderBy(desc(commercialSignals.opportunityScore), desc(commercialSignals.detectedAt))
      .limit(opts.limit ?? 25),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(commercialSignals)
      .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
      .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r.signal,
      organizationName: r.organizationName,
      trialNctId: r.trialNctId,
    })),
    total: n,
  };
}

/** A single signal, tenant-scoped, for the `/intelligence?signal=<id>` deep link. */
export async function getSignalById(tenantId: string, id: string): Promise<SignalRow | null> {
  const db = await getDb();
  const [r] = await db
    .select({
      signal: commercialSignals,
      organizationName: organizations.canonicalName,
      trialNctId: trials.nctId,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(and(eq(commercialSignals.tenantId, tenantId), eq(commercialSignals.id, id)))
    .limit(1);
  if (!r) return null;
  return { ...r.signal, organizationName: r.organizationName, trialNctId: r.trialNctId };
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
