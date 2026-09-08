/**
 * Opportunity scoring model (spec §15 / §86 / §88).
 *
 * Deterministic and interpretable — the language model never produces this
 * number (spec §57). Each component is bounded, every point is explained in
 * `rationale`, and the weights are configurable per tenant (spec §88).
 */
export const DEFAULT_WEIGHTS = {
  commercialFit: 25,
  clinicalTiming: 20,
  biomarkerNeed: 20,
  relationshipAccessibility: 10,
  signalStrength: 10,
  accountStrategicValue: 10,
  urgency: 5,
} as const;

export type ScoreWeights = typeof DEFAULT_WEIGHTS;

export interface ScoreComponents {
  commercialFit: number;
  clinicalTiming: number;
  biomarkerNeed: number;
  relationshipAccessibility: number;
  signalStrength: number;
  accountStrategicValue: number;
  urgency: number;
}

export interface ScoreResult {
  components: ScoreComponents;
  total: number;
  rationale: Record<keyof ScoreComponents, string>;
  /** Confidence in the interpretation/evidence — SEPARATE from opportunity (spec §16). */
  confidence: number;
  confidenceRationale: string;
}

export interface CapabilitySnapshot {
  capabilityFlags: Record<string, boolean>;
  cancerTypes: string[];
  targetIndications: string[];
  targetPathways: string[];
  mustPursue: string[];
  desirable: string[];
  exclusions: string[];
  minimumOpportunityScore: number;
}

export interface ScoreInput {
  weights: ScoreWeights;
  capability: CapabilitySnapshot;
  signalType: string;
  /** 0-100 commercial relevance of the underlying change (from diff.ts). */
  changeRelevance: number;
  /** Was the change confirmed against a primary source (spec §15 signal strength). */
  primarySource: boolean;
  trial: {
    phase: string;
    status: string;
    enrollment: number | null;
    molecularEligibility: boolean;
    ctdna: boolean;
    mrd: boolean;
    ngs: boolean;
    resistanceMonitoring: boolean;
    serialSampling: boolean;
    centralLab: boolean;
    conditions: string[];
    interventions: string[];
  };
  account: {
    tier: string; // strategic | priority | standard | watch | excluded
    hasWarmContact: boolean;
    hasPreviousReply: boolean;
    lastInteractionDays: number | null;
    colleagueEngaged: boolean;
  };
  /** Age of the triggering signal in days. */
  signalAgeDays: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const scale = (raw: number, max: number) => clamp(Math.round(raw), 0, max);

export function scoreOpportunity(input: ScoreInput): ScoreResult {
  const w = input.weights;
  const { trial, capability, account } = input;
  const rationale = {} as Record<keyof ScoreComponents, string>;

  // ── 1. Commercial Fit (does the program need what we sell?) ─────────────
  const flags = capability.capabilityFlags ?? {};
  const capabilityHits: string[] = [];
  if (trial.ctdna && (flags.ctdna || flags.liquid_biopsy)) capabilityHits.push("ctDNA");
  if (trial.mrd && flags.mrd) capabilityHits.push("MRD");
  if (trial.ngs && (flags.ngs || flags.wes || flags.wts)) capabilityHits.push("NGS/WES");
  if (trial.molecularEligibility && (flags.patient_selection || flags.cdx))
    capabilityHits.push("patient selection");
  if (trial.resistanceMonitoring && flags.resistance_monitoring)
    capabilityHits.push("resistance monitoring");
  if (trial.centralLab && flags.central_lab) capabilityHits.push("central lab");
  if (trial.serialSampling && (flags.liquid_biopsy || flags.ctdna))
    capabilityHits.push("serial plasma");

  const indicationHit = matchesAny(trial.conditions, [
    ...capability.cancerTypes,
    ...capability.targetIndications,
  ]);
  const exclusionHit = matchesAny(trial.conditions, capability.exclusions);

  let commercialFitRaw = capabilityHits.length * 6 + (indicationHit ? 5 : 0);
  if (exclusionHit) commercialFitRaw = Math.min(commercialFitRaw, 4);
  const commercialFit = scale(commercialFitRaw, w.commercialFit);
  rationale.commercialFit = exclusionHit
    ? `Indication matches an exclusion criterion — capped. Capability matches: ${
        capabilityHits.join(", ") || "none"
      }.`
    : capabilityHits.length
      ? `Program references ${capabilityHits.join(", ")}${
          indicationHit ? "; indication is in target list" : ""
        }.`
      : "No direct match between trial testing language and declared capabilities.";

  // ── 2. Clinical Timing (spec §70 — vendor-selection windows) ───────────
  const timingByPhase: Record<string, number> = {
    phase_1: 0.85,
    phase_1_2: 1,
    phase_2: 1,
    phase_2_3: 0.9,
    phase_3: 0.65,
    early_phase_1: 0.7,
    phase_4: 0.35,
    not_applicable: 0.3,
    unknown: 0.4,
  };
  const recruiting = ["recruiting", "not_yet_recruiting", "enrolling_by_invitation"].includes(
    trial.status,
  );
  const timingTriggerBoost = [
    "NEW_TRIAL",
    "NEW_TRIAL_COHORT",
    "NEW_COMBINATION_ARM",
    "TRIAL_PHASE_CHANGE",
    "TRIAL_EXPANSION",
    "NEW_BIOMARKER_REQUIREMENT",
  ].includes(input.signalType)
    ? 0.2
    : 0;
  const clinicalTiming = scale(
    ((timingByPhase[trial.phase] ?? 0.4) + timingTriggerBoost + (recruiting ? 0.05 : -0.1)) *
      w.clinicalTiming,
    w.clinicalTiming,
  );
  rationale.clinicalTiming = `${trial.phase} / ${trial.status}${
    timingTriggerBoost ? ` with a ${input.signalType} trigger` : ""
  } — ${
    clinicalTiming >= w.clinicalTiming * 0.7
      ? "inside a typical vendor-selection window"
      : "outside the strongest selection window"
  }.`;

  // ── 3. Biomarker / Diagnostic Need (spec §15) ─────────────────────────
  const needSignals = [
    trial.molecularEligibility && "molecular eligibility",
    trial.ctdna && "ctDNA",
    trial.mrd && "MRD",
    trial.ngs && "NGS",
    trial.serialSampling && "serial sampling",
    trial.resistanceMonitoring && "resistance analysis",
    trial.centralLab && "central testing",
  ].filter(Boolean) as string[];
  const biomarkerNeed = scale((needSignals.length / 4) * w.biomarkerNeed, w.biomarkerNeed);
  rationale.biomarkerNeed = needSignals.length
    ? `Trial record shows ${needSignals.join(", ")}.`
    : "No biomarker / molecular-testing need identified in the public record.";

  // ── 4. Relationship Accessibility (spec §15) ──────────────────────────
  let relRaw = 2;
  if (account.hasPreviousReply) relRaw += 5;
  else if (account.hasWarmContact) relRaw += 3;
  if (account.colleagueEngaged) relRaw += 1;
  if (account.lastInteractionDays != null && account.lastInteractionDays <= 90) relRaw += 2;
  const relationshipAccessibility = scale(relRaw, w.relationshipAccessibility);
  rationale.relationshipAccessibility = account.hasPreviousReply
    ? "Prior reply on record — warm."
    : account.hasWarmContact
      ? "Known contact but no reply yet."
      : "No existing relationship — cold.";

  // ── 5. Signal Strength (primary source > inference) (spec §15) ────────
  const signalStrength = scale(
    (input.primarySource ? 0.7 : 0.4) * w.signalStrength +
      (input.changeRelevance / 100) * (w.signalStrength * 0.3),
    w.signalStrength,
  );
  rationale.signalStrength = input.primarySource
    ? "Confirmed against a primary source (ClinicalTrials.gov record diff)."
    : "Derived from secondary interpretation — lower strength.";

  // ── 6. Account Strategic Value (spec §43) ────────────────────────────
  const tierScore: Record<string, number> = {
    strategic: 1,
    priority: 0.75,
    standard: 0.5,
    watch: 0.3,
    excluded: 0,
  };
  const enrollmentBoost = trial.enrollment && trial.enrollment >= 200 ? 0.15 : 0;
  const accountStrategicValue = scale(
    ((tierScore[account.tier] ?? 0.5) + enrollmentBoost) * w.accountStrategicValue,
    w.accountStrategicValue,
  );
  rationale.accountStrategicValue = `Account tier "${account.tier}"${
    enrollmentBoost ? "; large planned enrollment" : ""
  }.`;

  // ── 7. Urgency (spec §15 / §71) ─────────────────────────────────────
  const freshness = input.signalAgeDays <= 3 ? 1 : input.signalAgeDays <= 14 ? 0.6 : 0.25;
  const urgency = scale(freshness * w.urgency, w.urgency);
  rationale.urgency =
    input.signalAgeDays <= 3
      ? "Change detected within the last 3 days."
      : input.signalAgeDays <= 14
        ? "Change detected within the last two weeks."
        : "Change is more than two weeks old.";

  const components: ScoreComponents = {
    commercialFit,
    clinicalTiming,
    biomarkerNeed,
    relationshipAccessibility,
    signalStrength,
    accountStrategicValue,
    urgency,
  };
  const total = clamp(
    Object.values(components).reduce((a, b) => a + b, 0),
    0,
    100,
  );

  // ── Confidence (evidence quality, NOT attractiveness) ───────────────
  let confidence = 55;
  if (input.primarySource) confidence += 25;
  if (needSignals.length >= 2) confidence += 8;
  if (capabilityHits.length >= 1) confidence += 7;
  if (exclusionHit) confidence -= 10;
  confidence = clamp(confidence, 5, 98);

  return {
    components,
    total,
    rationale,
    confidence,
    confidenceRationale: input.primarySource
      ? "Underlying change is a verified field-level diff of the official trial record; commercial interpretation is rule-based."
      : "Underlying change relies on secondary interpretation; treat the commercial read as provisional.",
  };
}

function matchesAny(haystack: string[], needles: string[]): boolean {
  if (!needles.length) return false;
  const h = haystack.map((x) => x.toLowerCase());
  return needles.some((n) => {
    const t = n.toLowerCase().trim();
    return t.length > 1 && h.some((x) => x.includes(t) || t.includes(x));
  });
}
