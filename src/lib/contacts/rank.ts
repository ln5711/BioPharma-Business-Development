/**
 * Deterministic, explainable person-relevance rubric (spec: "Do not present the
 * score as a probability that the person will respond or buy"). Every factor
 * is a fixed, documented weight — never model-guessed. Function/program fit
 * outranks seniority alone: a program biomarker director can outscore a CEO.
 */

export type ContactLabel =
  | "direct_program_evidence"
  | "relevant_function_unconfirmed"
  | "potential_introducer";

export interface RankBreakdown {
  functionFit: number; // 0-35
  programEvidence: number; // 0-25
  useCaseFit: number; // 0-20
  decisionScope: number; // 0-10
  evidenceQuality: number; // 0-10
}

export interface RankInput {
  function: string; // buyerFunctionEnum value
  seniority: string; // seniorityEnum value
  /** Evidence explicitly ties this person to the NAMED asset/trial/program
   * (not just "works at the sponsor company"). */
  hasDirectProgramEvidence: boolean;
  /** How many liquid-biopsy / ctDNA / MRD / resistance-monitoring / companion-
   * diagnostic keyword hits appear in their description + evidence excerpts. */
  useCaseKeywordHits: number;
  evidenceCount: number;
  /** Count of DISTINCT source URLs (not repeats of the same page). */
  independentSourceCount: number;
  /** ISO date of the most recent piece of evidence, if known. */
  newestEvidenceDate: string | null;
}

export interface RankResult {
  total: number; // 0-100 — a relevance ranking, NOT a response/close probability
  breakdown: RankBreakdown;
  label: ContactLabel;
}

const FUNCTION_FIT: Record<string, number> = {
  translational_medicine: 35,
  biomarker_development: 35,
  precision_medicine: 32,
  companion_diagnostics: 32,
  clinical_development: 28,
  program_leadership: 26,
  external_innovation: 24,
  clinical_operations: 18,
  medical_affairs: 16,
  alliance_management: 14,
  business_development: 12,
  corporate_development: 8,
  executive: 10,
  other: 6,
};

// Deliberately NOT monotonic with org-chart rank — a director with program
// scope outranks a C-suite exec with none, per spec.
const DECISION_SCOPE: Record<string, number> = {
  head: 10,
  vp: 10,
  director: 9,
  svp: 8,
  senior_manager: 6,
  manager: 5,
  c_suite: 4,
  scientist: 4,
  individual_contributor: 2,
  unknown: 3,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function evidenceQualityScore(independentSourceCount: number, newestEvidenceDate: string | null): number {
  const base = independentSourceCount >= 2 ? 6 : independentSourceCount === 1 ? 3 : 0;
  if (!newestEvidenceDate) return base;
  const ageDays = (Date.now() - new Date(newestEvidenceDate).getTime()) / 86_400_000;
  const recencyBonus = ageDays <= 365 * 3 ? 4 : ageDays <= 365 * 5 ? 2 : 0;
  return clamp(base + recencyBonus, 0, 10);
}

export function scoreContact(input: RankInput): RankResult {
  const functionFit = FUNCTION_FIT[input.function] ?? FUNCTION_FIT.other;
  const programEvidence = input.hasDirectProgramEvidence ? 25 : input.evidenceCount > 0 ? 8 : 0;
  const useCaseFit = clamp(input.useCaseKeywordHits * 7, 0, 20);
  const decisionScope = DECISION_SCOPE[input.seniority] ?? DECISION_SCOPE.unknown;
  const evidenceQuality = evidenceQualityScore(input.independentSourceCount, input.newestEvidenceDate);

  const breakdown: RankBreakdown = { functionFit, programEvidence, useCaseFit, decisionScope, evidenceQuality };
  const total = clamp(
    functionFit + programEvidence + useCaseFit + decisionScope + evidenceQuality,
    0,
    100,
  );

  const label: ContactLabel =
    programEvidence >= 20
      ? "direct_program_evidence"
      : functionFit >= 24
        ? "relevant_function_unconfirmed"
        : "potential_introducer";

  return { total, breakdown, label };
}

/** Keyword set used to count use-case fit hits (liquid biopsy / ctDNA / MRD). */
export const LIQUID_BIOPSY_KEYWORDS = [
  "ctdna",
  "circulating tumor dna",
  "circulating tumour dna",
  "liquid biopsy",
  "mrd",
  "minimal residual disease",
  "molecular residual disease",
  "resistance monitoring",
  "companion diagnostic",
  "biomarker",
  "cfdna",
  "cell-free dna",
  "genomic profiling",
  "next-generation sequencing",
  "ngs",
];

export function countUseCaseKeywordHits(text: string): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const kw of LIQUID_BIOPSY_KEYWORDS) if (lower.includes(kw)) n++;
  return n;
}
