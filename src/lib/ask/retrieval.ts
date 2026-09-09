import "server-only";
import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  commercialSignals,
  organizations,
  signalSources,
  tasks,
  trialChanges,
  trials,
} from "@/db/schema";

/**
 * Bounded, allowlisted retrieval for Ask newwin.
 *
 * RULES (enforced here, not trusted to the model):
 *  - Every query is tenant-scoped from the VERIFIED session context. The model
 *    never supplies a tenant id, org id, or user id.
 *  - Only these named tools exist. There is no "run this SQL" path.
 *  - All inputs are validated + clamped; strings are used only as bound
 *    parameters (drizzle placeholders), never string-concatenated into SQL.
 *  - `ilike` patterns escape `%` and `_`.
 */

export interface RetrievalCtx {
  tenantId: string;
  userId: string;
}

const PHASES = [
  "early_phase_1",
  "phase_1",
  "phase_1_2",
  "phase_2",
  "phase_2_3",
  "phase_3",
  "phase_4",
  "not_applicable",
  "unknown",
] as const;
const STATUSES = [
  "not_yet_recruiting",
  "recruiting",
  "enrolling_by_invitation",
  "active_not_recruiting",
  "suspended",
  "terminated",
  "completed",
  "withdrawn",
  "unknown",
] as const;

export type TrialPhase = (typeof PHASES)[number];
export type TrialStatus = (typeof STATUSES)[number];

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const clampDays = (d: number | undefined, fallback: number) =>
  Math.min(3650, Math.max(1, Math.floor(d ?? fallback)));
const sinceFrom = (days: number) => new Date(Date.now() - days * 86_400_000);

// ── evidence shape ─────────────────────────────────────────────────────────
export interface Evidence {
  kind: "signal" | "trial_change" | "trial" | "task" | "company";
  id: string;
  title: string;
  summary: string;
  /** The date the underlying event happened (publication / CT.gov update). */
  eventDate: string | null;
  /** When newwin first imported/detected this record. */
  importedAt: string | null;
  /** Which date `eventDate` represents, for honest labelling. */
  eventDateKind: "first_posted" | "source_update" | "publication" | "detected" | "due" | null;
  /** Link to the exact record inside the app. */
  recordUrl: string;
  /** External source (publication URL, ClinicalTrials.gov, etc.). */
  sourceUrl: string | null;
  sourceLabel: string | null;
  meta?: Record<string, string | number | null>;
}

// ── tool 1: resolve companies ─────────────────────────────────────────────
export const resolveCompaniesSchema = z.object({ name: z.string().min(1).max(120) });

export async function resolveCompanies(
  ctx: RetrievalCtx,
  input: z.infer<typeof resolveCompaniesSchema>,
): Promise<{ id: string; name: string; type: string; recordUrl: string }[]> {
  const { name } = resolveCompaniesSchema.parse(input);
  const db = await getDb();
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.canonicalName,
      type: organizations.organizationType,
    })
    .from(organizations)
    .where(
      and(
        eq(organizations.tenantId, ctx.tenantId),
        or(
          ilike(organizations.canonicalName, likeArg(name)),
          ilike(organizations.canonicalDomain, likeArg(name)),
        ),
      ),
    )
    .orderBy(organizations.canonicalName)
    .limit(8);
  return rows.map((r) => ({ ...r, recordUrl: `/accounts/${r.id}` }));
}

// ── tool 2: developments for a specific company ───────────────────────────
export const companyDevelopmentsSchema = z.object({
  orgId: z.string().uuid(),
  sinceDays: z.number().int().positive().optional(),
  phases: z.array(z.enum(PHASES)).max(9).optional(),
  statuses: z.array(z.enum(STATUSES)).max(9).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function companyDevelopments(
  ctx: RetrievalCtx,
  input: z.infer<typeof companyDevelopmentsSchema>,
): Promise<{ company: string | null; evidence: Evidence[]; total: number }> {
  const p = companyDevelopmentsSchema.parse(input);
  const db = await getDb();

  // The org must belong to this tenant.
  const [org] = await db
    .select({ id: organizations.id, name: organizations.canonicalName })
    .from(organizations)
    .where(and(eq(organizations.id, p.orgId), eq(organizations.tenantId, ctx.tenantId)))
    .limit(1);
  if (!org) return { company: null, evidence: [], total: 0 };

  const days = clampDays(p.sinceDays, 90);
  const since = sinceFrom(days);
  const limit = p.limit ?? 20;

  // Signals for this org, ranked by EVENT date (sourceDate), falling back to detection.
  const sigRows = await db
    .select({
      s: commercialSignals,
      nct: trials.nctId,
      phase: trials.phase,
      status: trials.status,
    })
    .from(commercialSignals)
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(
      and(
        eq(commercialSignals.tenantId, ctx.tenantId),
        eq(commercialSignals.organizationId, p.orgId),
        gte(sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`, since),
        ...(p.phases?.length ? [inArray(trials.phase, p.phases)] : []),
        ...(p.statuses?.length ? [inArray(trials.status, p.statuses)] : []),
      ),
    )
    .orderBy(desc(sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`))
    .limit(limit);

  const sigIds = sigRows.map((r) => r.s.id);
  const srcBySig = await primarySources(sigIds);

  const evidence: Evidence[] = sigRows.map((r) => {
    const src = srcBySig.get(r.s.id);
    return {
      kind: "signal",
      id: r.s.id,
      title: r.s.headline,
      summary: r.s.factSummary,
      eventDate: iso(r.s.sourceDate ?? r.s.detectedAt),
      importedAt: iso(r.s.detectedAt),
      eventDateKind: r.s.sourceDate ? "source_update" : "detected",
      recordUrl: r.nct ? `/trials/${r.nct}` : `/intelligence?signal=${r.s.id}`,
      sourceUrl: src?.url ?? null,
      sourceLabel: src?.title ?? src?.type ?? null,
      meta: { signalType: r.s.signalType, opportunityScore: r.s.opportunityScore ?? null },
    };
  });

  // Trial changes where the trial is sponsored by this org.
  const chgRows = await db
    .select({ c: trialChanges, nct: trials.nctId, title: trials.title })
    .from(trialChanges)
    .innerJoin(trials, eq(trials.id, trialChanges.trialId))
    .where(
      and(
        eq(trialChanges.tenantId, ctx.tenantId),
        eq(trials.sponsorOrganizationId, p.orgId),
        gte(sql`coalesce(${trialChanges.sourceTimestamp}, ${trialChanges.detectedAt})`, since),
      ),
    )
    .orderBy(desc(sql`coalesce(${trialChanges.sourceTimestamp}, ${trialChanges.detectedAt})`))
    .limit(limit);

  for (const r of chgRows) {
    evidence.push({
      kind: "trial_change",
      id: r.c.id,
      title: `${r.title ?? r.nct}: ${r.c.fieldChanged.replace(/_/g, " ")}`,
      summary: r.c.summary,
      eventDate: iso(r.c.sourceTimestamp ?? r.c.detectedAt),
      importedAt: iso(r.c.detectedAt),
      eventDateKind: r.c.sourceTimestamp ? "source_update" : "detected",
      recordUrl: `/trials/${r.nct}`,
      sourceUrl: `https://clinicaltrials.gov/study/${r.nct}`,
      sourceLabel: "ClinicalTrials.gov",
      meta: { severity: r.c.severity, commercialRelevance: r.c.commercialRelevance },
    });
  }

  evidence.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
  return { company: org.name, evidence: evidence.slice(0, limit), total: evidence.length };
}

// ── tool 3: structured trial search ──────────────────────────────────────
export const searchTrialsSchema = z.object({
  company: z.string().max(120).optional(),
  nctId: z.string().regex(/^NCT\d{8}$/i).optional(),
  biomarker: z.string().max(80).optional(),
  indication: z.string().max(120).optional(),
  phases: z.array(z.enum(PHASES)).max(9).optional(),
  statuses: z.array(z.enum(STATUSES)).max(9).optional(),
  updatedWithinDays: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).max(2000).optional(),
});

export async function searchTrials(
  ctx: RetrievalCtx,
  input: z.infer<typeof searchTrialsSchema>,
): Promise<{ evidence: Evidence[]; total: number }> {
  const p = searchTrialsSchema.parse(input);
  const db = await getDb();
  const limit = p.limit ?? 20;
  const offset = p.offset ?? 0;

  const conds = [eq(trials.tenantId, ctx.tenantId)];
  if (p.nctId) conds.push(ilike(trials.nctId, p.nctId.toUpperCase()));
  if (p.company) {
    conds.push(
      or(
        ilike(trials.sponsorName, likeArg(p.company)),
        sql`exists (select 1 from ${organizations} o where o.id = ${trials.sponsorOrganizationId} and o.tenant_id = ${ctx.tenantId} and o.canonical_name ilike ${likeArg(p.company)})`,
      )!,
    );
  }
  if (p.biomarker) {
    conds.push(
      or(
        sql`${trials.biomarkerRequirements}::text ilike ${likeArg(p.biomarker)}`,
        ilike(trials.eligibilityText, likeArg(p.biomarker)),
        ilike(trials.title, likeArg(p.biomarker)),
      )!,
    );
  }
  if (p.indication) {
    conds.push(
      or(
        sql`${trials.conditionsRaw}::text ilike ${likeArg(p.indication)}`,
        ilike(trials.title, likeArg(p.indication)),
      )!,
    );
  }
  if (p.phases?.length) conds.push(inArray(trials.phase, p.phases));
  if (p.statuses?.length) conds.push(inArray(trials.status, p.statuses));
  if (p.updatedWithinDays) {
    conds.push(gte(trials.lastCtgovUpdate, sinceFrom(clampDays(p.updatedWithinDays, 30))));
  }

  const where = and(...conds);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trials)
    .where(where);

  const rows = await db
    .select({
      id: trials.id,
      nctId: trials.nctId,
      title: trials.title,
      phase: trials.phase,
      status: trials.status,
      sponsorName: trials.sponsorName,
      conditions: trials.conditionsRaw,
      startDate: trials.startDate,
      lastCtgovUpdate: trials.lastCtgovUpdate,
      firstPostedDate: trials.firstPostedDate,
      firstSeenAt: trials.firstSeenAt,
      commercialSummary: trials.commercialSummary,
    })
    .from(trials)
    .where(where)
    .orderBy(desc(sql`coalesce(${trials.lastCtgovUpdate}, ${trials.startDate}, ${trials.firstSeenAt})`))
    .limit(limit)
    .offset(offset);

  const evidence: Evidence[] = rows.map((r) => ({
    kind: "trial",
    id: r.nctId,
    title: `${r.nctId} — ${r.title ?? "Untitled"}`,
    summary: [r.sponsorName, (r.conditions ?? []).slice(0, 3).join(", "), r.commercialSummary]
      .filter(Boolean)
      .join(" · "),
    // The most recent real-world event date, then how to label it.
    eventDate: iso(r.lastCtgovUpdate ?? r.firstPostedDate ?? r.startDate),
    importedAt: iso(r.firstSeenAt),
    eventDateKind: r.lastCtgovUpdate
      ? "source_update"
      : r.firstPostedDate
        ? "first_posted"
        : r.startDate
          ? "first_posted"
          : "detected",
    recordUrl: `/trials/${r.nctId}`,
    sourceUrl: `https://clinicaltrials.gov/study/${r.nctId}`,
    sourceLabel: "ClinicalTrials.gov",
    meta: { phase: r.phase, status: r.status },
  }));

  return { evidence, total: n };
}

// ── tool 4: full trial for compare ──────────────────────────────────────
export const getTrialSchema = z.object({ nctId: z.string().regex(/^NCT\d{8}$/i) });

export async function getTrial(ctx: RetrievalCtx, input: z.infer<typeof getTrialSchema>) {
  const { nctId } = getTrialSchema.parse(input);
  const db = await getDb();
  const [t] = await db
    .select()
    .from(trials)
    .where(and(eq(trials.tenantId, ctx.tenantId), ilike(trials.nctId, nctId.toUpperCase())))
    .limit(1);
  if (!t) return null;
  return {
    nctId: t.nctId,
    title: t.title,
    officialTitle: t.officialTitle,
    phase: t.phase,
    status: t.status,
    sponsorName: t.sponsorName,
    enrollment: t.enrollment,
    conditions: t.conditionsRaw,
    interventions: t.interventionsRaw,
    primaryEndpoints: t.primaryEndpoints,
    biomarkerRequirements: t.biomarkerRequirements,
    molecularEligibility: t.molecularEligibility,
    ctdnaMentions: t.ctdnaMentions,
    startDate: iso(t.startDate),
    primaryCompletionDate: iso(t.primaryCompletionDate),
    lastCtgovUpdate: iso(t.lastCtgovUpdate),
    firstPostedDate: iso(t.firstPostedDate),
    firstSeenAt: iso(t.firstSeenAt),
    commercialSummary: t.commercialSummary,
    recordUrl: `/trials/${t.nctId}`,
    sourceUrl: `https://clinicaltrials.gov/study/${t.nctId}`,
  };
}

// ── tool 5: overdue tasks for the current user ──────────────────────────
export async function overdueTasks(ctx: RetrievalCtx): Promise<Evidence[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.tenantId, ctx.tenantId),
        eq(tasks.userId, ctx.userId),
        eq(tasks.done, false),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, new Date()),
      ),
    )
    .orderBy(tasks.dueAt)
    .limit(50);
  return rows.map((t) => ({
    kind: "task",
    id: t.id,
    title: t.title,
    summary: `Due ${iso(t.dueAt)} · ${t.category.replace(/_/g, " ")}`,
    eventDate: iso(t.dueAt),
    importedAt: iso(t.createdAt),
    eventDateKind: "due",
    recordUrl: t.relatedOrganizationId ? `/accounts/${t.relatedOrganizationId}` : "/",
    sourceUrl: null,
    sourceLabel: null,
  }));
}

// ── tool 6: bounded keyword signal search ──────────────────────────────
export const searchSignalsSchema = z.object({
  term: z.string().min(2).max(120),
  sinceDays: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

export async function searchSignals(
  ctx: RetrievalCtx,
  input: z.infer<typeof searchSignalsSchema>,
): Promise<{ evidence: Evidence[]; total: number }> {
  const p = searchSignalsSchema.parse(input);
  const db = await getDb();
  const term = likeArg(p.term);
  const conds = [
    eq(commercialSignals.tenantId, ctx.tenantId),
    or(
      ilike(commercialSignals.headline, term),
      ilike(commercialSignals.factSummary, term),
      ilike(organizations.canonicalName, term),
    )!,
  ];
  if (p.sinceDays) {
    conds.push(
      gte(
        sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`,
        sinceFrom(clampDays(p.sinceDays, 30)),
      ),
    );
  }
  const where = and(...conds);

  const rows = await db
    .select({ s: commercialSignals, orgName: organizations.canonicalName, nct: trials.nctId })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(where)
    .orderBy(desc(sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`))
    .limit(p.limit ?? 15);

  const srcBySig = await primarySources(rows.map((r) => r.s.id));
  const evidence: Evidence[] = rows.map((r) => {
    const src = srcBySig.get(r.s.id);
    return {
      kind: "signal",
      id: r.s.id,
      title: r.s.headline,
      summary: [r.orgName, r.s.factSummary].filter(Boolean).join(" · "),
      eventDate: iso(r.s.sourceDate ?? r.s.detectedAt),
      importedAt: iso(r.s.detectedAt),
      eventDateKind: r.s.sourceDate ? "source_update" : "detected",
      recordUrl: r.nct ? `/trials/${r.nct}` : `/intelligence?signal=${r.s.id}`,
      sourceUrl: src?.url ?? null,
      sourceLabel: src?.title ?? src?.type ?? null,
      meta: { signalType: r.s.signalType, opportunityScore: r.s.opportunityScore ?? null },
    };
  });
  return { evidence, total: evidence.length };
}

// ── helpers ────────────────────────────────────────────────────────────
async function primarySources(signalIds: string[]) {
  const map = new Map<string, { url: string | null; title: string | null; type: string }>();
  if (!signalIds.length) return map;
  const db = await getDb();
  const rows = await db
    .select()
    .from(signalSources)
    .where(inArray(signalSources.signalId, signalIds))
    .orderBy(desc(signalSources.publishedAt));
  for (const s of rows) {
    if (!map.has(s.signalId)) map.set(s.signalId, { url: s.url, title: s.title, type: s.sourceType });
  }
  return map;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
