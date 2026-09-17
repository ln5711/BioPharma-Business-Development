import {
  CDX_PATTERNS,
  CENTRAL_LAB_PATTERNS,
  CTDNA_PATTERNS,
  MOLECULAR_ELIGIBILITY_PATTERNS,
  MRD_PATTERNS,
  NGS_PATTERNS,
  RESISTANCE_PATTERNS,
  SERIAL_SAMPLING_PATTERNS,
} from "./keywords";

/**
 * Every "commercial relevance" pill on the trial page is a TEXT MATCH, not a
 * structured ClinicalTrials.gov fact. This resolves each flag back to its
 * supporting excerpt so the UI can show provenance instead of presenting an
 * inference as a certainty. If a flag has no crisp supporting line, it is
 * reported as `evidenced: false` and the page should not show it as a confident
 * pill (spec: "If no exact central-lab evidence exists, do not show 'Central lab
 * testing' as a confident pill.").
 */

export type FlagDerivation = "structured" | "text" | "inference";

export interface FlagEvidence {
  key: string;
  label: string;
  /** true when the flag column is set on the trial row */
  flagged: boolean;
  /** how the value was derived */
  derivation: FlagDerivation;
  /** which public field the excerpt came from */
  sourceField: string | null;
  /** the exact supporting sentence/line, trimmed */
  excerpt: string | null;
  /** true only when a concrete excerpt was found */
  evidenced: boolean;
}

interface FlagSpec {
  key: string;
  label: string;
  patterns: RegExp[];
}

const FLAGS: FlagSpec[] = [
  { key: "molecularEligibility", label: "Molecular eligibility required", patterns: MOLECULAR_ELIGIBILITY_PATTERNS },
  { key: "ctdnaMentions", label: "ctDNA / liquid biopsy", patterns: CTDNA_PATTERNS },
  { key: "mrdMentions", label: "MRD language", patterns: MRD_PATTERNS },
  { key: "ngsMentions", label: "NGS / genomic profiling", patterns: NGS_PATTERNS },
  { key: "serialSamplingMentions", label: "Serial specimen collection", patterns: SERIAL_SAMPLING_PATTERNS },
  { key: "resistanceMonitoringMentions", label: "Resistance monitoring", patterns: RESISTANCE_PATTERNS },
  { key: "centralLabMentions", label: "Central lab testing", patterns: CENTRAL_LAB_PATTERNS },
];

// Extra evidence source for the CDx-adjacent flags.
void CDX_PATTERNS;

/** Split text into candidate sentences/lines for excerpting. */
function segments(text: string): string[] {
  return text
    .split(/(?<=[.;:])\s+|\r?\n+|(?:•|·|•|\*)\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 8 && s.length <= 320);
}

function firstMatch(patterns: RegExp[], sources: { field: string; text: string | null | undefined }[]) {
  for (const src of sources) {
    if (!src.text) continue;
    for (const seg of segments(src.text)) {
      if (patterns.some((re) => re.test(seg))) return { field: src.field, excerpt: seg };
    }
  }
  return null;
}

export interface TrialForFlagEvidence {
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  serialSamplingMentions: boolean;
  resistanceMonitoringMentions: boolean;
  centralLabMentions: boolean;
  eligibilityText: string | null;
  commercialSummary: string | null;
  biomarkerRequirements: string[];
}

export function explainTrialFlags(trial: TrialForFlagEvidence): FlagEvidence[] {
  const sources = [
    { field: "Eligibility criteria", text: trial.eligibilityText },
    { field: "Biomarker requirement lines", text: (trial.biomarkerRequirements ?? []).join("\n") },
  ];

  return FLAGS.map((f): FlagEvidence => {
    const flagged = Boolean((trial as unknown as Record<string, boolean>)[f.key]);
    const m = firstMatch(f.patterns, sources);
    return {
      key: f.key,
      label: f.label,
      flagged,
      // Nothing here is a structured CT.gov field — it is always a text match,
      // or (flag set but no crisp line) a broader-context inference.
      derivation: m ? "text" : "inference",
      sourceField: m?.field ?? null,
      excerpt: m?.excerpt ?? null,
      evidenced: Boolean(m),
    };
  });
}
