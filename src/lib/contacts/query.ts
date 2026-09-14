import { LIQUID_BIOPSY_KEYWORDS } from "./rank";

/** buyerFunctionEnum value → phrases a free-text search might use for it. */
export const FUNCTION_SYNONYMS: Record<string, string[]> = {
  translational_medicine: ["translational medicine", "translational oncology", "translational science", "translational research"],
  biomarker_development: ["biomarker development", "biomarker strategy", "biomarker lead", "biomarkers", "biomarker"],
  precision_medicine: ["precision medicine", "precision oncology"],
  companion_diagnostics: ["companion diagnostic", "companion dx", " cdx "],
  clinical_development: ["clinical development"],
  program_leadership: ["program lead", "program director", "program head", "program leadership"],
  clinical_operations: ["clinical operations", "clinical ops"],
  external_innovation: ["external innovation", "business development", "licensing", "alliance management", "partnerships", "diagnostic partnership"],
  medical_affairs: ["medical affairs"],
};

export interface ContactQueryContext {
  companyName?: string | null;
  assetOrTrialLabel?: string | null;
  useCase?: string | null;
}

export interface ParsedContactQuery {
  raw: string;
  companyName: string | null;
  functionHints: string[];
  useCaseHints: string[];
  assetOrTrialLabel: string | null;
}

const CAP_STOP = new Set([
  "Find", "Who", "Show", "List", "Search", "The", "Contacts", "People", "Leaders",
]);

function extractCompany(raw: string): string | null {
  for (const re of [
    /\bat\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Za-z0-9&.\-]+){0,3})\b/,
    /\b(?:for|from|with)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Za-z0-9&.\-]+){0,3})\s+(?:contacts|people|team)\b/,
  ]) {
    const m = re.exec(raw);
    if (m) {
      let s = m[1].trim().replace(/[.,]+$/, "");
      const words = s.split(/\s+/).filter((w) => !CAP_STOP.has(w));
      s = words.join(" ");
      if (s && /[a-z]/.test(s)) return s;
    }
  }
  return null;
}

function extractAssetOrTrial(raw: string): string | null {
  const nct = /NCT\d{8}/i.exec(raw);
  if (nct) return nct[0].toUpperCase();
  const m = /\bfor\s+([A-Z][A-Za-z0-9-]{1,20})\b/.exec(raw);
  if (m && /[0-9-]/.test(m[1])) return m[1]; // a development-code-looking token, e.g. "RMC-6236"
  return null;
}

/**
 * Deterministic parse of a free-text contact-discovery query, with page/signal
 * context filling gaps but never overriding an explicit mention in the text.
 */
export function parseContactQuery(raw: string, context: ContactQueryContext = {}): ParsedContactQuery {
  const q = raw.trim();
  const lower = ` ${q.toLowerCase()} `;

  const functionHints = new Set<string>();
  for (const [fn, phrases] of Object.entries(FUNCTION_SYNONYMS)) {
    if (phrases.some((p) => lower.includes(p))) functionHints.add(fn);
  }

  const useCaseHints = new Set<string>();
  for (const kw of LIQUID_BIOPSY_KEYWORDS) if (lower.includes(kw)) useCaseHints.add(kw);
  if (context.useCase) useCaseHints.add(context.useCase.toLowerCase());

  const companyName = extractCompany(q) ?? context.companyName ?? null;
  const assetOrTrialLabel = extractAssetOrTrial(q) ?? context.assetOrTrialLabel ?? null;

  return {
    raw: q,
    companyName,
    functionHints: [...functionHints],
    useCaseHints: [...useCaseHints],
    assetOrTrialLabel,
  };
}
