/**
 * Deterministic ontology keyword detectors (spec §85 — "relevance keyword /
 * ontology filter" before any expensive LLM call; spec §67 — preserve precise
 * scientific distinctions).
 *
 * These feed the ClinicalTrials.gov normalizer's commercial-intelligence flags
 * and the opportunity-scoring "biomarker need" component.
 */

const has = (text: string, patterns: RegExp[]) =>
  patterns.some((re) => re.test(text));

export const CTDNA_PATTERNS = [
  /\bct\s?-?dna\b/i,
  /circulating tumou?r dna/i,
  /\bcfdna\b/i,
  /cell[- ]free dna/i,
  /liquid biopsy/i,
  /plasma (?:genotyping|sequencing|ngs)/i,
];

export const MRD_PATTERNS = [
  /\bmrd\b/i,
  /minimal residual disease/i,
  /molecular residual disease/i,
  /measurable residual disease/i,
  /molecular relapse/i,
];

export const NGS_PATTERNS = [
  /\bngs\b/i,
  /next[- ]generation sequencing/i,
  /whole[- ]exome/i,
  /\bwes\b/i,
  /whole[- ]transcriptome/i,
  /\bwts\b/i,
  /comprehensive genomic profiling/i,
  /tumou?r mutational burden/i,
  /\btmb\b/i,
];

export const RESISTANCE_PATTERNS = [
  /acquired resistance/i,
  /resistance mutation/i,
  /mechanisms? of resistance/i,
  /on[- ]treatment biopsy/i,
  /resistance monitoring/i,
];

export const MOLECULAR_ELIGIBILITY_PATTERNS = [
  /\bmutation[- ]positive\b/i,
  /documented .{0,30}(mutation|alteration|amplification|fusion)/i,
  /(known|confirmed|centrally confirmed) .{0,20}(mutation|alteration)/i,
  /positive for .{0,20}(mutation|fusion|amplification)/i,
  /harbou?ring .{0,20}(mutation|alteration|fusion)/i,
  /\bKRAS\s*(G12[CDVARS]|G13|Q61)/i,
  /\bEGFR\s*(exon\s*(19|20|21)|L858R|T790M)/i,
  /\bBRAF\s*V600/i,
  /\bHER2\b.{0,15}(amplif|positive|mutation)/i,
  /companion diagnostic/i,
  /\bFDA[- ]approved test\b/i,
];

export const SERIAL_SAMPLING_PATTERNS = [
  /serial (?:blood|plasma|sample)/i,
  /longitudinal .{0,20}(sampl|plasma|blood|ctdna)/i,
  /(?:blood|plasma) draws? at multiple/i,
  /repeated? (?:blood|plasma) collection/i,
  /on[- ]treatment .{0,15}sampl/i,
];

export const CENTRAL_LAB_PATTERNS = [
  /central(?:ized)? (?:lab|laboratory|testing|review)/i,
  /central molecular testing/i,
  /sponsor[- ]designated laboratory/i,
];

export const CDX_PATTERNS = [
  /companion diagnostic/i,
  /\bcdx\b/i,
  /\bFDA[- ]authoriz(?:ed|ed) test\b/i,
  /investigational assay/i,
];

export interface TrialSignalFlags {
  ctdna: boolean;
  mrd: boolean;
  ngs: boolean;
  resistanceMonitoring: boolean;
  molecularEligibility: boolean;
  serialSampling: boolean;
  centralLab: boolean;
  cdx: boolean;
}

export function detectTrialSignalFlags(...texts: (string | null | undefined)[]): TrialSignalFlags {
  const blob = texts.filter(Boolean).join("\n\n");
  return {
    ctdna: has(blob, CTDNA_PATTERNS),
    mrd: has(blob, MRD_PATTERNS),
    ngs: has(blob, NGS_PATTERNS),
    resistanceMonitoring: has(blob, RESISTANCE_PATTERNS),
    molecularEligibility: has(blob, MOLECULAR_ELIGIBILITY_PATTERNS),
    serialSampling: has(blob, SERIAL_SAMPLING_PATTERNS),
    centralLab: has(blob, CENTRAL_LAB_PATTERNS),
    cdx: has(blob, CDX_PATTERNS),
  };
}

/** Extract biomarker-requirement phrases for display (spec §141). */
export function extractBiomarkerRequirements(eligibility: string | null | undefined): string[] {
  if (!eligibility) return [];
  const out = new Set<string>();
  const lines = eligibility.split(/\r?\n/);
  for (const line of lines) {
    if (
      /(mutation|alteration|amplification|fusion|expression|biomarker|KRAS|EGFR|BRAF|HER2|ALK|ROS1|MET|RET|NTRK|BRCA|MSI|TMB|PD-L1)/i.test(
        line,
      ) &&
      /(required|must have|positive|confirmed|documented|eligible|inclusion)/i.test(line)
    ) {
      out.add(line.replace(/^[\s*\-•]+/, "").trim().slice(0, 240));
    }
  }
  return [...out].slice(0, 12);
}
