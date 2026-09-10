import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  capabilityProfiles,
  interactions,
  jobRuns,
  relationships,
  sourceRegistry,
  trialChanges,
  trialSnapshots,
  trials,
  watchlists,
} from "@/db/schema";
import type { CapabilitySnapshot } from "@/lib/scoring/model";
import { emitSignal, type AccountContextForSignal } from "@/lib/signals/emit";
import { CtgovClient } from "./client";
import { diffTrials } from "./diff";
import { resolveOrganization } from "./entities";
import { normalizeStudy, type NormalizedTrial } from "./normalize";
import type { CtgovQuery, CtgovStudy } from "./types";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface IngestStats {
  fetched: number;
  newTrials: number;
  updatedTrials: number;
  unchangedTrials: number;
  trialChanges: number;
  signalsCreated: number;
  signalsUpdated: number;
  errors: number;
}

const STUDY_URL = (nct: string) => `https://clinicaltrials.gov/study/${nct}`;

/**
 * Full ClinicalTrials.gov ingestion pass for one tenant watchlist
 * (spec §6 / §58 / §116). fetch → normalize → resolveEntities → snapshot →
 * detectChanges → emitSignals. Idempotent: an unchanged record on the next
 * refresh produces no new snapshot, change, or signal (acceptance test §105).
 */
export async function ingestWatchlist(
  db: Db,
  opts: { tenantId: string; watchlistId: string; maxStudies?: number },
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0,
    newTrials: 0,
    updatedTrials: 0,
    unchangedTrials: 0,
    trialChanges: 0,
    signalsCreated: 0,
    signalsUpdated: 0,
    errors: 0,
  };

  const [job] = await db
    .insert(jobRuns)
    .values({ tenantId: opts.tenantId, jobName: "ctgov:ingestWatchlist", status: "running" })
    .returning({ id: jobRuns.id });

  const [wl] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, opts.watchlistId), eq(watchlists.tenantId, opts.tenantId)))
    .limit(1);
  if (!wl) throw new Error(`watchlist ${opts.watchlistId} not found for tenant`);

  const capability = await loadCapability(db, opts.tenantId);
  const weights = undefined; // default model; per-tenant profiles applied in a later pass

  const query: CtgovQuery = {
    terms: wl.ctgovQuery?.terms ?? [],
    conditions: wl.ctgovQuery?.conditions ?? [],
    statuses: wl.ctgovQuery?.statuses ?? [
      "RECRUITING",
      "ACTIVE_NOT_RECRUITING",
      "NOT_YET_RECRUITING",
      "ENROLLING_BY_INVITATION",
    ],
    maxStudies: opts.maxStudies ?? 300,
  };

  const client = new CtgovClient();
  const [reg] = await db
    .select()
    .from(sourceRegistry)
    .where(
      and(
        eq(sourceRegistry.tenantId, opts.tenantId),
        eq(sourceRegistry.sourceType, "clinicaltrials_gov"),
      ),
    )
    .limit(1);

  try {
    for await (const study of client.studies(query)) {
      stats.fetched += 1;
      try {
        await ingestStudy(db, opts.tenantId, study, capability, weights, stats);
      } catch (err) {
        stats.errors += 1;
        console.error("ctgov ingestStudy error", (err as Error).message);
      }
    }

    if (reg) {
      await db
        .update(sourceRegistry)
        .set({
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          lastChangeAt:
            stats.newTrials + stats.updatedTrials > 0 ? new Date() : reg.lastChangeAt,
          failureCount: 0,
          health: "healthy",
          signalsProduced: sql`${sourceRegistry.signalsProduced} + ${stats.signalsCreated}`,
        })
        .where(eq(sourceRegistry.id, reg.id));
    }

    await db
      .update(jobRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        stats: stats as unknown as Record<string, number>,
      })
      .where(eq(jobRuns.id, job.id));
  } catch (err) {
    if (reg) {
      await db
        .update(sourceRegistry)
        .set({
          lastCheckedAt: new Date(),
          lastFailureAt: new Date(),
          failureCount: sql`${sourceRegistry.failureCount} + 1`,
          lastError: (err as Error).message,
          health: "failing",
        })
        .where(eq(sourceRegistry.id, reg.id));
    }
    await db
      .update(jobRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        error: (err as Error).message,
        stats: stats as unknown as Record<string, number>,
      })
      .where(eq(jobRuns.id, job.id));
    throw err;
  }

  return stats;
}

/**
 * Import a SINGLE ClinicalTrials.gov study into a tenant's workspace by NCT id —
 * the "Save to workspace" action from Ask newwin's public-research results.
 * Reuses the full ingest path (normalize → snapshot → signal), so a saved trial
 * behaves exactly like one picked up by a watchlist. Idempotent: saving the same
 * NCT twice updates the existing row rather than duplicating it.
 *
 * Returns `{ imported, alreadyPresent }` — `imported` is false only when the
 * study id does not resolve at ClinicalTrials.gov.
 */
export async function importTrialByNct(
  db: Db,
  tenantId: string,
  nctId: string,
): Promise<{ imported: boolean; alreadyPresent: boolean; nctId: string }> {
  const id = nctId.trim().toUpperCase();
  if (!/^NCT\d{8}$/.test(id)) throw new Error(`invalid NCT id: ${nctId}`);

  const [existing] = await db
    .select({ id: trials.id })
    .from(trials)
    .where(and(eq(trials.tenantId, tenantId), eq(trials.nctId, id)))
    .limit(1);

  const study = await new CtgovClient().fetchOne(id);
  if (!study) return { imported: false, alreadyPresent: !!existing, nctId: id };

  const capability = await loadCapability(db, tenantId);
  const stats: IngestStats = {
    fetched: 1,
    newTrials: 0,
    updatedTrials: 0,
    unchangedTrials: 0,
    trialChanges: 0,
    signalsCreated: 0,
    signalsUpdated: 0,
    errors: 0,
  };
  await ingestStudy(db, tenantId, study, capability, undefined, stats);
  return { imported: true, alreadyPresent: !!existing, nctId: id };
}

/**
 * Persist a batch of already-fetched ClinicalTrials.gov studies into a tenant's
 * workspace — used by the search service to opportunistically save trials it
 * pulled live so they are locally searchable next time. Bounded, best-effort:
 * an error on one study does not abort the batch. Reuses the full ingest path
 * (normalize → snapshot → diff → signal), so persisted rows are indistinguishable
 * from watchlist-ingested ones.
 */
export async function ingestStudies(
  db: Db,
  tenantId: string,
  studies: CtgovStudy[],
  opts: { cap?: number } = {},
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0,
    newTrials: 0,
    updatedTrials: 0,
    unchangedTrials: 0,
    trialChanges: 0,
    signalsCreated: 0,
    signalsUpdated: 0,
    errors: 0,
  };
  const cap = Math.max(0, Math.min(opts.cap ?? 15, studies.length));
  if (cap === 0) return stats;
  const capability = await loadCapability(db, tenantId);
  for (const study of studies.slice(0, cap)) {
    stats.fetched += 1;
    try {
      await ingestStudy(db, tenantId, study, capability, undefined, stats);
    } catch (err) {
      stats.errors += 1;
      console.error("ctgov ingestStudies error", (err as Error).message);
    }
  }
  return stats;
}

async function ingestStudy(
  db: Db,
  tenantId: string,
  study: CtgovStudy,
  capability: CapabilitySnapshot,
  weights: undefined,
  stats: IngestStats,
) {
  const next = normalizeStudy(study);
  if (!next.nctId) return;

  const organizationId = next.sponsorName
    ? await resolveOrganization(db, tenantId, next.sponsorName)
    : null;

  const [existing] = await db
    .select()
    .from(trials)
    .where(and(eq(trials.tenantId, tenantId), eq(trials.nctId, next.nctId)))
    .limit(1);

  const account = organizationId
    ? await loadAccountContext(db, tenantId, organizationId)
    : COLD_ACCOUNT;

  // ── New trial ────────────────────────────────────────────────────────
  if (!existing) {
    const [trialRow] = await db
      .insert(trials)
      .values(toTrialInsert(tenantId, organizationId, next))
      .returning();
    stats.newTrials += 1;

    const [snap] = await db
      .insert(trialSnapshots)
      .values({
        trialId: trialRow.id,
        nctId: next.nctId,
        recordVersionHash: next.recordVersionHash,
        ctgovLastUpdate: next.lastCtgovUpdate,
        payload: next as unknown as Record<string, unknown>,
        rawPayload: study as unknown as Record<string, unknown>,
      })
      .returning({ id: trialSnapshots.id });

    // Distinguish a genuinely new posting from a historical trial we are just
    // now importing. `firstPostedDate` = when ClinicalTrials.gov first published
    // it; if that is well in the past, this is "added to the workspace", not
    // "newly announced". The signal's sourceDate is the real first-posted date
    // so time-window queries ("this week") behave correctly.
    const firstPosted = next.firstPostedDate;
    const importDate = new Date();
    const HISTORICAL_MS = 45 * 86_400_000;
    const isHistorical =
      !!firstPosted && importDate.getTime() - firstPosted.getTime() > HISTORICAL_MS;
    const phaseLabel = next.phase.replace(/_/g, " ");
    const factSummary = isHistorical
      ? `Trial ${next.nctId} (${phaseLabel}, first posted on ClinicalTrials.gov ${firstPosted!
          .toISOString()
          .slice(0, 10)}) added to your monitored set. Sponsor: ${
          next.sponsorName ?? "unknown"
        }. "${next.title ?? ""}".`
      : `New ${phaseLabel} trial ${next.nctId}${
          firstPosted ? ` first posted ${firstPosted.toISOString().slice(0, 10)}` : ""
        } by ${next.sponsorName ?? "unknown sponsor"}: "${next.title ?? ""}".`;

    const res = await emitSignal(db, {
      tenantId,
      signalType: "NEW_TRIAL",
      organizationId,
      trial: trialCtx(trialRow.id, next),
      factSummary,
      changeRelevance: isHistorical ? 35 : 65,
      sourceDate: firstPosted ?? next.lastCtgovUpdate,
      sourceUrl: STUDY_URL(next.nctId),
      capability,
      account,
      weights,
    });
    if (res.created) stats.signalsCreated += 1;
    else stats.signalsUpdated += 1;
    void snap;
    return;
  }

  // ── Unchanged ────────────────────────────────────────────────────────
  if (existing.recordVersionHash === next.recordVersionHash) {
    stats.unchangedTrials += 1;
    await db
      .update(trials)
      .set({ lastRefreshedAt: new Date() })
      .where(eq(trials.id, existing.id));
    return;
  }

  // ── Changed: diff prior snapshot → new snapshot ──────────────────────
  const [priorSnap] = await db
    .select()
    .from(trialSnapshots)
    .where(eq(trialSnapshots.trialId, existing.id))
    .orderBy(desc(trialSnapshots.capturedAt))
    .limit(1);

  const prev = (priorSnap?.payload as unknown as NormalizedTrial | undefined) ?? next;

  const [newSnap] = await db
    .insert(trialSnapshots)
    .values({
      trialId: existing.id,
      nctId: next.nctId,
      recordVersionHash: next.recordVersionHash,
      ctgovLastUpdate: next.lastCtgovUpdate,
      payload: next as unknown as Record<string, unknown>,
      rawPayload: study as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: trialSnapshots.id });

  await db
    .update(trials)
    .set({ ...toTrialUpdate(organizationId, next), lastRefreshedAt: new Date() })
    .where(eq(trials.id, existing.id));
  stats.updatedTrials += 1;

  const detected = diffTrials(prev, next);
  for (const change of detected) {
    const [changeRow] = await db
      .insert(trialChanges)
      .values({
        tenantId,
        trialId: existing.id,
        nctId: next.nctId,
        fromSnapshotId: priorSnap?.id ?? null,
        toSnapshotId: newSnap?.id ?? null,
        fieldChanged: change.fieldChanged,
        oldValue: change.oldValue,
        newValue: change.newValue,
        severity: change.severity as never,
        commercialRelevance: change.commercialRelevance,
        summary: change.summary,
        sourceTimestamp: next.lastCtgovUpdate,
      })
      .onConflictDoNothing()
      .returning({ id: trialChanges.id });

    if (!changeRow) continue; // duplicate change already recorded (idempotent)
    stats.trialChanges += 1;

    const res = await emitSignal(db, {
      tenantId,
      signalType: change.signalType,
      organizationId,
      trial: trialCtx(existing.id, next),
      trialChangeId: changeRow.id,
      factSummary: `${next.nctId}: ${change.summary}.`,
      changeRelevance: change.commercialRelevance,
      sourceDate: next.lastCtgovUpdate,
      sourceUrl: STUDY_URL(next.nctId),
      capability,
      account,
      weights,
    });
    if (res.created) stats.signalsCreated += 1;
    else stats.signalsUpdated += 1;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

const COLD_ACCOUNT: AccountContextForSignal = {
  tier: "standard",
  hasWarmContact: false,
  hasPreviousReply: false,
  lastInteractionDays: null,
  colleagueEngaged: false,
};

async function loadCapability(db: Db, tenantId: string): Promise<CapabilitySnapshot> {
  const [cp] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.tenantId, tenantId))
    .limit(1);
  return {
    capabilityFlags: cp?.capabilityFlags ?? {},
    cancerTypes: cp?.cancerTypes ?? [],
    targetIndications: cp?.targetIndications ?? [],
    targetPathways: cp?.targetPathways ?? [],
    mustPursue: cp?.mustPursue ?? [],
    desirable: cp?.desirable ?? [],
    exclusions: cp?.exclusions ?? [],
    minimumOpportunityScore: cp?.minimumOpportunityScore ?? 50,
  };
}

async function loadAccountContext(
  db: Db,
  tenantId: string,
  organizationId: string,
): Promise<AccountContextForSignal> {
  const [rel] = await db
    .select({
      lastResponseAt: relationships.lastResponseAt,
      lastContactedAt: relationships.lastContactedAt,
    })
    .from(relationships)
    .where(
      and(
        eq(relationships.tenantId, tenantId),
        eq(relationships.organizationId, organizationId),
      ),
    )
    .orderBy(desc(relationships.lastContactedAt))
    .limit(1);

  const [lastInteraction] = await db
    .select({ occurredAt: interactions.occurredAt })
    .from(interactions)
    .where(
      and(
        eq(interactions.tenantId, tenantId),
        eq(interactions.organizationId, organizationId),
      ),
    )
    .orderBy(desc(interactions.occurredAt))
    .limit(1);

  const lastDate = lastInteraction?.occurredAt ?? rel?.lastContactedAt ?? null;

  return {
    tier: "standard",
    hasWarmContact: Boolean(rel),
    hasPreviousReply: Boolean(rel?.lastResponseAt),
    lastInteractionDays: lastDate
      ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
      : null,
    colleagueEngaged: Boolean(rel?.lastContactedAt),
  };
}

function trialCtx(id: string, n: NormalizedTrial) {
  return {
    id,
    nctId: n.nctId,
    title: n.title,
    phase: n.phase,
    status: n.status,
    enrollment: n.enrollment,
    molecularEligibility: n.molecularEligibility,
    ctdnaMentions: n.ctdnaMentions,
    mrdMentions: n.mrdMentions,
    ngsMentions: n.ngsMentions,
    resistanceMonitoringMentions: n.resistanceMonitoringMentions,
    serialSamplingMentions: n.serialSamplingMentions,
    centralLabMentions: n.centralLabMentions,
    conditionsRaw: n.conditionsRaw,
    interventionsRaw: n.interventionsRaw,
    commercialSummary: n.commercialSummary,
  };
}

function toTrialInsert(
  tenantId: string,
  organizationId: string | null,
  n: NormalizedTrial,
) {
  return {
    tenantId,
    nctId: n.nctId,
    title: n.title,
    officialTitle: n.officialTitle,
    sponsorName: n.sponsorName,
    sponsorOrganizationId: organizationId,
    collaborators: n.collaborators,
    phase: n.phase as never,
    status: n.status as never,
    studyType: n.studyType,
    enrollment: n.enrollment,
    enrollmentType: n.enrollmentType,
    conditionsRaw: n.conditionsRaw,
    interventionsRaw: n.interventionsRaw,
    armsRaw: n.armsRaw,
    countries: n.countries,
    locationCount: n.locationCount,
    locationsRaw: n.locationsRaw,
    eligibilityText: n.eligibilityText,
    primaryEndpoints: n.primaryEndpoints,
    secondaryEndpoints: n.secondaryEndpoints,
    exploratoryEndpoints: n.exploratoryEndpoints,
    startDate: n.startDate,
    primaryCompletionDate: n.primaryCompletionDate,
    completionDate: n.completionDate,
    lastCtgovUpdate: n.lastCtgovUpdate,
    firstPostedDate: n.firstPostedDate,
    molecularEligibility: n.molecularEligibility,
    biomarkerRequirements: n.biomarkerRequirements,
    ctdnaMentions: n.ctdnaMentions,
    mrdMentions: n.mrdMentions,
    ngsMentions: n.ngsMentions,
    resistanceMonitoringMentions: n.resistanceMonitoringMentions,
    centralLabMentions: n.centralLabMentions,
    serialSamplingMentions: n.serialSamplingMentions,
    biospecimenRetention: n.biospecimenRetention,
    commercialSummary: n.commercialSummary,
    recordVersionHash: n.recordVersionHash,
  };
}

function toTrialUpdate(organizationId: string | null, n: NormalizedTrial) {
  const full = toTrialInsert("", organizationId, n);
  const { tenantId, nctId, ...rest } = full;
  void tenantId; void nctId;
  return rest;
}
