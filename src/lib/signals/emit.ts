import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { commercialSignals, signalSources } from "@/db/schema";
import {
  DEFAULT_WEIGHTS,
  scoreOpportunity,
  type CapabilitySnapshot,
  type ScoreWeights,
} from "@/lib/scoring/model";
import { SUPPRESSED_OUTREACH_SIGNALS, signalMeta } from "./taxonomy";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface TrialContextForSignal {
  id: string;
  nctId: string;
  title: string | null;
  phase: string;
  status: string;
  enrollment: number | null;
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  resistanceMonitoringMentions: boolean;
  serialSamplingMentions: boolean;
  centralLabMentions: boolean;
  conditionsRaw: string[];
  interventionsRaw: { type: string; name: string }[];
  commercialSummary: string;
}

export interface AccountContextForSignal {
  tier: string;
  hasWarmContact: boolean;
  hasPreviousReply: boolean;
  lastInteractionDays: number | null;
  colleagueEngaged: boolean;
}

export interface EmitSignalArgs {
  tenantId: string;
  signalType: string;
  organizationId: string | null;
  assetId?: string | null;
  trial: TrialContextForSignal;
  trialChangeId?: string | null;
  /** Human-readable statement of the observed FACT. */
  factSummary: string;
  changeRelevance: number;
  sourceDate: Date | null;
  sourceUrl: string;
  capability: CapabilitySnapshot;
  account: AccountContextForSignal;
  weights?: ScoreWeights;
}

export interface EmitResult {
  signalId: string;
  created: boolean;
  opportunityScore: number;
  confidence: number;
}

/**
 * Turns a resolved, deduplicated event into a CommercialSignal (spec §13).
 * FACT / INFERENCE / RECOMMENDATION are stored in separate fields (spec §56);
 * the score is computed by deterministic code (spec §57).
 */
export async function emitSignal(db: Db, args: EmitSignalArgs): Promise<EmitResult> {
  const meta = signalMeta(args.signalType);
  const weights = args.weights ?? DEFAULT_WEIGHTS;
  const signalAgeDays = args.sourceDate
    ? Math.max(0, Math.floor((Date.now() - args.sourceDate.getTime()) / 86_400_000))
    : 0;

  const score = scoreOpportunity({
    weights,
    capability: args.capability,
    signalType: args.signalType,
    changeRelevance: args.changeRelevance,
    primarySource: true, // ClinicalTrials.gov record diff
    trial: {
      phase: args.trial.phase,
      status: args.trial.status,
      enrollment: args.trial.enrollment,
      molecularEligibility: args.trial.molecularEligibility,
      ctdna: args.trial.ctdnaMentions,
      mrd: args.trial.mrdMentions,
      ngs: args.trial.ngsMentions,
      resistanceMonitoring: args.trial.resistanceMonitoringMentions,
      serialSampling: args.trial.serialSamplingMentions,
      centralLab: args.trial.centralLabMentions,
      conditions: args.trial.conditionsRaw,
      interventions: args.trial.interventionsRaw.map((i) => i.name),
    },
    account: args.account,
    signalAgeDays,
  });

  const suppressed = SUPPRESSED_OUTREACH_SIGNALS.has(args.signalType);
  const { scientificInterpretation, commercialInterpretation, whyItMatters, whyNow, recommendedAction } =
    buildInterpretation(args, score.total, suppressed, signalAgeDays);

  const dedupeKey = makeDedupeKey(args);
  const headline = buildHeadline(args);

  const values = {
    tenantId: args.tenantId,
    signalType: args.signalType as never,
    category: meta.category as never,
    organizationId: args.organizationId,
    assetId: args.assetId ?? null,
    trialId: args.trial.id,
    trialChangeId: args.trialChangeId ?? null,
    headline,
    factSummary: args.factSummary,
    scientificInterpretation,
    commercialInterpretation,
    whyItMatters,
    whyNow,
    recommendedAction,
    recommendedPersonas: meta.personas,
    urgency: meta.urgency as never,
    opportunityScore: score.total,
    confidenceScore: score.confidence,
    scoreBreakdown: {
      ...score.components,
      total: score.total,
    } as Record<string, number>,
    dedupeKey,
    sourceDate: args.sourceDate,
  };

  const [row] = await db
    .insert(commercialSignals)
    .values(values)
    .onConflictDoUpdate({
      target: [commercialSignals.tenantId, commercialSignals.dedupeKey],
      set: {
        opportunityScore: values.opportunityScore,
        confidenceScore: values.confidenceScore,
        scoreBreakdown: values.scoreBreakdown,
        whyNow: values.whyNow,
        recommendedAction: values.recommendedAction,
        headline: values.headline,
        factSummary: values.factSummary,
      },
    })
    .returning({
      id: commercialSignals.id,
      createdAt: commercialSignals.createdAt,
    });

  const created = Date.now() - new Date(row.createdAt).getTime() < 5000;

  await db
    .insert(signalSources)
    .values({
      signalId: row.id,
      sourceType: "clinicaltrials_gov",
      title: `ClinicalTrials.gov — ${args.trial.nctId}`,
      url: args.sourceUrl,
      publishedAt: args.sourceDate,
      excerpt: args.factSummary,
      claimKind: "fact",
    })
    .onConflictDoNothing();

  return {
    signalId: row.id,
    created,
    opportunityScore: score.total,
    confidence: score.confidence,
  };
}

function makeDedupeKey(args: EmitSignalArgs): string {
  // Cluster identical events: same trial + signal type + change fingerprint
  // (spec §13 — "Never allow five sources … to generate five separate opportunities").
  const material = [
    args.trial.nctId,
    args.signalType,
    args.factSummary.toLowerCase().replace(/\s+/g, " ").trim(),
  ].join("|");
  return createHash("sha1").update(material).digest("hex");
}

function buildHeadline(args: EmitSignalArgs): string {
  const meta = signalMeta(args.signalType);
  return `${meta.label} — ${args.trial.title ?? args.trial.nctId}`;
}

function buildInterpretation(
  args: EmitSignalArgs,
  score: number,
  suppressed: boolean,
  ageDays: number,
) {
  const meta = signalMeta(args.signalType);
  const t = args.trial;
  const needBits = [
    t.molecularEligibility && "molecular eligibility",
    t.ctdnaMentions && "ctDNA / liquid biopsy",
    t.mrdMentions && "MRD",
    t.serialSamplingMentions && "serial specimen collection",
    t.resistanceMonitoringMentions && "resistance monitoring",
    t.ngsMentions && "NGS profiling",
  ].filter(Boolean) as string[];

  const scientificInterpretation =
    needBits.length > 0
      ? `The trial record for ${t.nctId} references ${needBits.join(", ")}. ${t.commercialSummary}`
      : `${t.commercialSummary} No specific molecular-testing language is present in the current public record.`;

  const commercialInterpretation = suppressed
    ? `This is a negative / sensitive development. Do not initiate standard outbound sales outreach (spec §46). Pause any active sequence for this program and reassess.`
    : needBits.length > 0
      ? `INFERENCE: the program may need an external molecular-testing or translational partner for ${needBits.join(
          ", ",
        )}. Public evidence does not confirm whether a provider is already engaged — treat as "no publicly disclosed partner identified".`
      : `INFERENCE: limited direct commercial pull from this change on its own; monitor for follow-on biomarker or cohort activity.`;

  const whyItMatters =
    meta.category === "clinical_trial" && !suppressed
      ? `${meta.label} on a ${t.phase.replace("_", " ")} ${t.status.replace(/_/g, " ")} study is a moment when external vendors are commonly selected or expanded (spec §70).`
      : `Signal recorded for landscape awareness.`;

  const whyNow = args.sourceDate
    ? `ClinicalTrials.gov record updated ${ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`}.`
    : `Detected on the latest ClinicalTrials.gov refresh.`;

  const recommendedAction = suppressed
    ? `Notify the account owner. Pause active outreach. Re-evaluate once the program's direction is clear.`
    : score >= args.capability.minimumOpportunityScore
      ? `Map ${meta.personas.slice(0, 2).join(" and ").replace(/_/g, " ")} stakeholders on the sponsor, confirm no colleague is mid-conversation, then draft evidence-based outreach.`
      : `Hold. Score is below the tenant threshold (${args.capability.minimumOpportunityScore}). Keep on the watchlist for follow-on signals.`;

  return {
    scientificInterpretation,
    commercialInterpretation,
    whyItMatters,
    whyNow,
    recommendedAction,
  };
}

/** Count of open (non-dismissed) signals for a tenant — used by the dashboard. */
export async function countOpenSignals(db: Db, tenantId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(commercialSignals)
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        sql`${commercialSignals.status} <> 'dismissed'`,
      ),
    );
  return row?.n ?? 0;
}
