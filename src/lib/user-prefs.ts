import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userPreferences, type Priority } from "@/db/schema";
import { recommendedById } from "@/lib/priorities";

export type HomeRange = "24h" | "7d" | "30d";

export const RANGE_MS: Record<HomeRange, number> = {
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
};

export interface UserPrefs {
  priorities: Priority[];
  watchCompanies: string[];
  therapeuticAreas: string[];
  biomarkers: string[];
  pathways: string[];
  homeRange: HomeRange;
  onboardedAt: Date | null;
}

const EMPTY: UserPrefs = {
  priorities: [],
  watchCompanies: [],
  therapeuticAreas: [],
  biomarkers: [],
  pathways: [],
  homeRange: "24h",
  onboardedAt: null,
};

export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  if (!row) return EMPTY;
  return {
    priorities: [...row.priorities].sort((a, b) => a.order - b.order),
    watchCompanies: row.watchCompanies,
    therapeuticAreas: row.therapeuticAreas,
    biomarkers: row.biomarkers,
    pathways: row.pathways,
    homeRange: (["24h", "7d", "30d"].includes(row.homeRange) ? row.homeRange : "24h") as HomeRange,
    onboardedAt: row.onboardedAt,
  };
}

/** Build Priority rows from onboarding input (recommended ids + custom text). */
export function buildPriorities(recommendedIds: string[], customTexts: string[]): Priority[] {
  const out: Priority[] = [];
  let order = 0;
  for (const id of recommendedIds) {
    const rec = recommendedById(id);
    if (!rec) continue;
    out.push({ id: randomUUID(), recommendedId: id, text: rec.label, paused: false, order: order++ });
  }
  for (const text of customTexts.map((t) => t.trim()).filter(Boolean)) {
    out.push({ id: randomUUID(), text, paused: false, order: order++ });
  }
  return out;
}

/**
 * Oncology short-forms that MUST survive tokenisation even though they are ≤3
 * chars, plus the synonyms/expansions each one implies. Keys and values are all
 * lower-cased; values are added as extra match terms.
 */
const ONCOLOGY_SYNONYMS: Record<string, string[]> = {
  ras: ["kras", "nras", "hras", "ras pathway"],
  kras: ["kras g12c", "kras g12d", "ras"],
  nras: ["ras"],
  met: ["met exon 14", "c-met", "met amplification"],
  ret: ["ret fusion", "ret-altered"],
  alk: ["alk fusion", "alk-positive", "anaplastic lymphoma kinase"],
  ros1: ["ros-1", "ros1 fusion"],
  egfr: ["egfr exon 20", "egfr mutant"],
  her2: ["her-2", "erbb2", "her2-low"],
  braf: ["braf v600e", "braf-mutant"],
  ntrk: ["trk fusion", "ntrk fusion"],
  fgfr: ["fgfr2", "fgfr3"],
  idh1: ["idh", "idh-mutant"],
  idh2: ["idh", "idh-mutant"],
  crc: ["colorectal", "colorectal cancer", "mcrc"],
  nsclc: ["non-small cell lung", "non small cell lung", "lung cancer"],
  sclc: ["small cell lung"],
  mcrpc: ["castration-resistant prostate", "prostate cancer"],
  tnbc: ["triple-negative breast", "triple negative breast"],
  aml: ["acute myeloid leukemia", "acute myeloid leukaemia"],
  cll: ["chronic lymphocytic leukemia"],
  dlbcl: ["diffuse large b-cell"],
  hcc: ["hepatocellular", "liver cancer"],
  gist: ["gastrointestinal stromal"],
  ctdna: ["circulating tumor dna", "circulating tumour dna", "liquid biopsy", "mrd"],
  mrd: ["minimal residual disease", "molecular residual disease", "ctdna"],
  io: ["immuno-oncology", "immunotherapy", "checkpoint inhibitor"],
  adc: ["antibody-drug conjugate", "antibody drug conjugate"],
  cdx: ["companion diagnostic", "companion dx"],
};

/** Terms this short/gene-symbol keyword should be matched on word boundaries. */
const BOUNDARY_MAX_LEN = 5;

export interface PriorityMatcher {
  /** Multi-word phrases → plain substring match. */
  phrases: string[];
  /** Short tokens / gene symbols → whole-word (boundary) match. */
  tokens: string[];
}

/**
 * Build the matcher for a priority: recommended-catalogue terms + the user's own
 * words + oncology synonym expansion. Short tokens (RAS, MET, RET, ALK, CRC …)
 * are NOT dropped — they move to `tokens` and are matched on word boundaries so
 * "RAS" hits "KRAS G12C" / "RAS pathway" but not "harass".
 */
export function priorityMatcher(p: Priority): PriorityMatcher {
  const rec = p.recommendedId ? recommendedById(p.recommendedId) : undefined;
  const phrases = new Set<string>();
  const tokens = new Set<string>();

  const add = (term: string) => {
    const t = term.toLowerCase().trim();
    if (!t) return;
    if (/\s/.test(t) || t.length > BOUNDARY_MAX_LEN) phrases.add(t);
    else tokens.add(t);
  };

  for (const m of rec?.match ?? []) add(m);

  const cleaned = p.text.toLowerCase().replace(/[^a-z0-9 /-]/g, " ");
  // Whole space-separated words, PLUS their hyphen/slash sub-parts, so
  // "RAS-altered" also yields "ras" (→ its KRAS/NRAS synonyms).
  const rawWords = new Set<string>();
  for (const w of cleaned.split(/\s+/).filter(Boolean)) {
    rawWords.add(w);
    for (const part of w.split(/[/-]+/).filter(Boolean)) rawWords.add(part);
  }
  for (const w of rawWords) {
    if (STOP.has(w)) continue;
    const known = Boolean(ONCOLOGY_SYNONYMS[w]);
    if (w.length <= 2 && !known) continue; // drop bare 1–2 char noise
    if (w.length <= 3 && !known && !/[0-9]/.test(w)) continue; // keep only known short terms
    add(w);
    for (const syn of ONCOLOGY_SYNONYMS[w] ?? []) add(syn);
  }

  return { phrases: [...phrases], tokens: [...tokens] };
}

const BOUNDARY_CACHE = new Map<string, RegExp>();
function boundaryRe(token: string): RegExp {
  let re = BOUNDARY_CACHE.get(token);
  if (!re) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`, "i");
    BOUNDARY_CACHE.set(token, re);
  }
  return re;
}

/** Does `haystack` (already lower-cased) satisfy this matcher? */
export function matchesPriority(haystack: string, m: PriorityMatcher): boolean {
  for (const phrase of m.phrases) if (phrase && haystack.includes(phrase)) return true;
  for (const token of m.tokens) if (boundaryRe(token).test(haystack)) return true;
  return false;
}

/** Back-compat: flat keyword list (phrases + tokens). Prefer `priorityMatcher`. */
export function priorityKeywords(p: Priority): string[] {
  const m = priorityMatcher(p);
  return [...m.phrases, ...m.tokens];
}

const STOP = new Set([
  "find",
  "help",
  "with",
  "that",
  "this",
  "from",
  "into",
  "companies",
  "company",
  "track",
  "tracking",
  "focus",
  "prepare",
  "meeting",
  "meetings",
  "identify",
  "research",
  "opportunities",
  "prospective",
  "starting",
  "entering",
  "expand",
  "business",
  "the",
  "and",
  "for",
  "our",
  "new",
]);
