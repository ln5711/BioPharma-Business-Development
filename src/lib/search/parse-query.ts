/**
 * Deterministic query parser for newwin search.
 *
 * Turns a natural-language string ("KRAS G12D pancreatic trials recruiting")
 * into structured criteria WITHOUT an LLM. This is what fixes the "words like
 * 'today' hijack the query" bug: freshness words are recognised as freshness,
 * not as a signal to open the Home recommendation flow. Recommendation mode is
 * only chosen for an explicit "what should I focus on" style prompt that carries
 * NO searchable entity.
 */

import type {
  Freshness,
  ParsedQuery,
  QueryIntents,
  TrialPhase,
  TrialStatus,
} from "./types";

// ── vocabularies ──────────────────────────────────────────────────────────

/** Genes / targets / biomarkers. Order matters: longer forms first. */
const BIOMARKERS: string[] = [
  "KRAS G12C", "KRAS G12D", "KRAS G12V", "KRAS G12R", "KRAS G12A", "KRAS G12S",
  "KRAS G13D", "KRAS Q61H", "KRAS",
  "NRAS", "HRAS",
  "EGFR EX20", "EGFR EXON 20", "EGFR T790M", "EGFR L858R", "EGFR",
  "HER2", "ERBB2",
  "ALK", "ROS1", "RET", "MET EX14", "MET", "NTRK", "NTRK1", "NTRK2", "NTRK3",
  "BRAF V600E", "BRAF V600", "BRAF",
  "FGFR1", "FGFR2", "FGFR3", "FGFR",
  "PIK3CA", "AKT1", "PTEN",
  "BRCA1", "BRCA2", "BRCA",
  "IDH1", "IDH2",
  "PSMA", "FRA", "FRΑ", "TROP2", "TROP-2", "CLDN18.2", "CLAUDIN 18.2",
  "MSI-H", "MSI", "DMMR", "MMR", "TMB", "PD-L1", "PDL1", "PD-1",
  "CDK4", "CDK6", "CDK4/6",
  "MYC", "TP53", "STK11", "KEAP1", "SMARCA4",
  "CTDNA", "MRD",
];

/** Pathways — coarse groupings for "what changed in the RAS pathway". */
const PATHWAYS: Record<string, string[]> = {
  RAS: ["kras", "nras", "hras", "ras pathway", "ras/mapk", "pan-ras", "pan ras"],
  MAPK: ["mapk", "mek", "erk", "raf"],
  "PI3K": ["pi3k", "pik3ca", "akt", "mtor", "pten"],
  DDR: ["brca", "parp", "atm", "atr", "homologous recombination"],
};

/**
 * Well-known oncology drug / development-code names. The regex below also
 * catches generic development codes (RMC-6236, MRTX1133, AMG 510, BI 1701963).
 */
const KNOWN_ASSETS: string[] = [
  "sotorasib", "lumakras", "adagrasib", "krazati", "divarasib", "garsorasib",
  "glecirasib", "opnurasib", "fulzerasib", "zoldonrasib", "daraxonrasib",
  "elironrasib", "olomorasib",
  "osimertinib", "tagrisso", "amivantamab", "rybrevant", "lazertinib",
  "trastuzumab deruxtecan", "enhertu", "t-dxd", "trastuzumab", "pertuzumab",
  "sacituzumab govitecan", "trodelvy", "datopotamab deruxtecan", "dato-dxd",
  "pembrolizumab", "keytruda", "nivolumab", "opdivo", "atezolizumab", "tecentriq",
  "durvalumab", "imfinzi", "cemiplimab",
  "lorlatinib", "alectinib", "brigatinib", "crizotinib", "entrectinib",
  "selpercatinib", "pralsetinib", "capmatinib", "tepotinib",
  "olaparib", "niraparib", "rucaparib", "talazoparib",
  "encorafenib", "dabrafenib", "vemurafenib", "binimetinib", "trametinib",
  "pluvicto", "lutetium lu 177", "lu-177", "177lu",
  "ribociclib", "kisqali", "palbociclib", "abemaciclib", "verzenio",
  "alpelisib", "capivasertib", "inavolisib",
];

/** Disease / indication terms → a canonical phrase. */
const INDICATIONS: Record<string, string[]> = {
  "pancreatic cancer": ["pancreatic", "pdac", "pancreas", "pancreatic ductal adenocarcinoma"],
  "non-small cell lung cancer": ["nsclc", "non-small cell", "non small cell", "lung adenocarcinoma"],
  "small cell lung cancer": ["sclc", "small cell lung"],
  "lung cancer": ["lung cancer", "\\blung\\b"],
  "colorectal cancer": ["colorectal", "\\bcrc\\b", "colon cancer", "rectal cancer"],
  "breast cancer": ["breast cancer", "\\bbreast\\b", "\\btnbc\\b", "triple negative", "triple-negative", "hr\\+", "hr-positive"],
  "prostate cancer": ["prostate", "\\bcrpc\\b", "\\bmcrpc\\b"],
  "ovarian cancer": ["ovarian", "fallopian"],
  "endometrial cancer": ["endometrial", "uterine"],
  "melanoma": ["melanoma", "uveal melanoma"],
  "glioblastoma": ["glioblastoma", "\\bgbm\\b", "glioma"],
  "hepatocellular carcinoma": ["hepatocellular", "\\bhcc\\b", "liver cancer"],
  "cholangiocarcinoma": ["cholangiocarcinoma", "biliary tract", "bile duct"],
  "gastric cancer": ["gastric", "stomach cancer", "gastroesophageal", "\\bgej\\b"],
  "bladder cancer": ["bladder", "urothelial"],
  "head and neck cancer": ["head and neck", "\\bhnscc\\b", "\\bscchn\\b"],
  "acute myeloid leukemia": ["\\baml\\b", "acute myeloid"],
  "multiple myeloma": ["multiple myeloma", "\\bmm\\b relapsed", "\\brrmm\\b"],
  "lymphoma": ["lymphoma", "\\bdlbcl\\b", "\\bnhl\\b", "hodgkin"],
  "leukemia": ["leukemia", "leukaemia", "\\ball\\b lymphoblastic", "\\bcll\\b"],
  "solid tumors": ["solid tumou?rs?", "advanced solid", "metastatic solid"],
};

/**
 * Large-cap + notable oncology companies / sponsors. The capitalised-token
 * fallback catches the rest; this list makes the common ones robust even when
 * the user types them lower-case ("amgen kras").
 */
const KNOWN_COMPANIES: string[] = [
  "amgen", "mirati", "revolution medicines", "revolution", "genentech", "roche",
  "novartis", "astrazeneca", "merck", "msd", "pfizer", "bristol myers squibb",
  "bristol-myers squibb", "bms", "johnson & johnson", "j&j", "janssen",
  "eli lilly", "lilly", "gsk", "glaxosmithkline", "sanofi", "bayer",
  "boehringer ingelheim", "boehringer", "takeda", "gilead", "arcus",
  "daiichi sankyo", "daiichi", "abbvie", "bridgebio", "blueprint medicines",
  "blueprint", "deciphera", "exelixis", "incyte", "jazz pharmaceuticals",
  "jazz", "moderna", "biontech", "regeneron", "seagen", "immunocore",
  "nuvation", "verastem", "erasca", "mirador", "kumquat", "frontier medicines",
  "boundless bio", "quanta therapeutics", "theras", "elicio",
];

/** Words that should never anchor a match — strip before ranking. */
const CONTROL_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "to", "by", "at", "with", "from",
  "and", "or", "vs", "versus", "about", "any", "all", "as",
  "show", "find", "search", "list", "get", "give", "tell", "look", "see",
  "me", "us", "our", "my", "i", "what", "whats", "which", "who", "whom",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "has", "have", "had",
  "trial", "trials", "study", "studies", "clinical",
  "today", "yesterday", "week", "weeks", "month", "months", "day", "days",
  "this", "last", "past", "recent", "recently", "latest", "newest", "new",
  "updated", "update", "current", "currently", "now", "changed", "change",
  "please", "can", "could", "would", "should", "want", "need",
  "results", "result", "data", "info", "information", "news", "overview",
]);

// ── phase / status maps ───────────────────────────────────────────────────

const PHASE_PATTERNS: [RegExp, TrialPhase][] = [
  [/early[\s-]?phase\s*1|early[\s-]?phase\s*i\b/i, "early_phase_1"],
  [/phase\s*1\s*\/\s*2|phase\s*i\s*\/\s*ii|phase\s*1\s*and\s*2/i, "phase_1_2"],
  [/phase\s*2\s*\/\s*3|phase\s*ii\s*\/\s*iii/i, "phase_2_3"],
  [/\bphase\s*4\b|\bphase\s*iv\b/i, "phase_4"],
  [/\bphase\s*3\b|\bphase\s*iii\b|\bph\s*3\b|\bp3\b/i, "phase_3"],
  [/\bphase\s*2\b|\bphase\s*ii\b|\bph\s*2\b|\bp2\b/i, "phase_2"],
  [/\bphase\s*1\b|\bphase\s*i\b|\bph\s*1\b|\bp1\b|first[\s-]in[\s-]human/i, "phase_1"],
];

const STATUS_PATTERNS: [RegExp, TrialStatus][] = [
  [/not[\s-]yet[\s-]recruiting/i, "not_yet_recruiting"],
  [/enrolling by invitation/i, "enrolling_by_invitation"],
  [/active[,\s-]*not recruiting/i, "active_not_recruiting"],
  [/\brecruit(?:ing)?\b|\benrolling\b|\bopen\b/i, "recruiting"],
  [/\bcompleted?\b/i, "completed"],
  [/\bterminated?\b|\bwithdrawn\b|\bsuspended?\b|\bhalted?\b|\bstopped?\b/i, "terminated"],
];

// ── freshness ─────────────────────────────────────────────────────────────

function parseFreshness(lower: string): Freshness {
  let days: number | null = null;
  let label: string | null = null;

  if (/\btoday\b|\blast 24\b|\bovernight\b|\bpast 24\b/.test(lower)) {
    days = 1;
    label = "today";
  } else if (/\byesterday\b/.test(lower)) {
    days = 2;
    label = "the last day";
  } else if (/\bthis week\b|\blast 7\b|\bpast week\b|\bpast 7\b|\bin the last week\b/.test(lower)) {
    days = 7;
    label = "this week";
  } else if (/\bthis month\b|\blast 30\b|\bpast month\b|\bpast 30\b/.test(lower)) {
    days = 30;
    label = "this month";
  } else if (/\bthis quarter\b|\blast 90\b|\bpast quarter\b/.test(lower)) {
    days = 90;
    label = "this quarter";
  }
  const m = /\b(?:last|past)\s+(\d{1,4})\s+days?\b/.exec(lower);
  if (m) {
    days = Math.min(3650, Math.max(1, Number(m[1])));
    label = `the last ${m[1]} days`;
  }

  const softRecency = /\b(recent(?:ly)?|latest|newest|new|current(?:ly)?|updated?|just\s+(?:announced|posted)|breaking)\b/.test(lower);
  const updatedEmphasis = /\b(updated?|changed?|amend(?:ed|ment)|revised?)\b/.test(lower);
  // "new … today" = first posted; "… updated today" = last CT.gov update;
  // "latest …" = whichever is more recent. "updated" wins when both words appear.
  const postedEmphasis = /\b(new(?:ly)?|just\s+(?:posted|added|listed)|first\s+posted|first-in-human)\b/.test(lower);
  const kind: "posted" | "updated" | "any" = updatedEmphasis
    ? "updated"
    : postedEmphasis
      ? "posted"
      : "any";

  // "recent KRAS trials" with no explicit window → a sensible 60-day default so
  // the result set is current without being empty.
  if (days === null && softRecency) {
    days = 60;
    label = label ?? "recently";
  }

  return { days, label, kind, wants: softRecency || days !== null, updatedEmphasis };
}

// ── helpers ───────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findAll(haystack: string, needles: string[]): string[] {
  const out: string[] = [];
  const used: [number, number][] = [];
  for (const n of needles) {
    const re = new RegExp(`(?<![A-Za-z0-9])${esc(n)}(?![A-Za-z0-9])`, "i");
    const m = re.exec(haystack);
    if (!m) continue;
    const start = m.index;
    const end = start + m[0].length;
    // skip if this span is already covered by a longer earlier match
    if (used.some(([s, e]) => start >= s && end <= e)) continue;
    used.push([start, end]);
    out.push(n);
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim().slice(0, 400);
  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");

  const nctIds = [...trimmed.matchAll(/NCT\s?\d{8}/gi)].map((m) =>
    m[0].replace(/\s/g, "").toUpperCase(),
  );

  // biomarkers (longest-first, de-overlapped)
  const biomarkers = findAll(normalized, BIOMARKERS).map((b) => b.toUpperCase());

  // assets: known names + development-code pattern
  const knownAssets = findAll(normalized, KNOWN_ASSETS);
  const codeAssets = [
    ...trimmed.matchAll(/\b([A-Z]{2,5})[\s-]?(\d{2,6})\b/g),
  ]
    .map((m) => `${m[1].toUpperCase()}-${m[2]}`)
    // drop things that are really biomarkers/phases ("KRAS G12", "PHASE 3")
    .filter((c) => !/^(PHASE|PH|P)-/.test(c))
    .filter((c) => !biomarkers.some((b) => c.startsWith(b.replace(/\s.*/, "").toUpperCase() + "-")));
  const assets = [...new Set([...knownAssets, ...codeAssets])];

  // indications
  const indications: string[] = [];
  for (const [canon, pats] of Object.entries(INDICATIONS)) {
    if (pats.some((p) => new RegExp(p, "i").test(normalized))) indications.push(canon);
  }

  // pathways
  const pathways: string[] = [];
  for (const [name, pats] of Object.entries(PATHWAYS)) {
    if (pats.some((p) => new RegExp(p.includes("\\b") ? p : `\\b${esc(p)}\\b`, "i").test(normalized))) {
      pathways.push(name);
    }
  }

  // companies: known list, then capitalised-token fallback
  const companies = new Set(findAll(normalized, KNOWN_COMPANIES).map(titleCase));
  const CAP_STOP = new Set([
    "What", "Which", "Who", "Show", "Find", "List", "Get", "Compare", "The",
    "Search", "Latest", "Recent", "New", "Trials", "Trial", "Study", "Phase",
    "Recruiting", "Today", "This",
  ]);
  for (const m of trimmed.matchAll(/\b([A-Z][A-Za-z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,2})\b/g)) {
    let token = m[1];
    while (token && CAP_STOP.has(token.split(/\s+/)[0])) {
      token = token.split(/\s+/).slice(1).join(" ");
    }
    if (!token) continue;
    if (/^NCT\d/i.test(token)) continue;
    if (!/[a-z]/.test(token)) continue; // all-caps → gene, not company
    if (biomarkers.some((b) => b.toLowerCase() === token.toLowerCase())) continue;
    if (assets.some((a) => a.toLowerCase() === token.toLowerCase())) continue;
    companies.add(token);
  }

  // phases / statuses
  const phases: TrialPhase[] = [];
  for (const [re, ph] of PHASE_PATTERNS) {
    if (re.test(normalized) && !phases.includes(ph)) phases.push(ph);
  }
  const statuses: TrialStatus[] = [];
  for (const [re, st] of STATUS_PATTERNS) {
    if (re.test(normalized) && !statuses.includes(st)) statuses.push(st);
  }

  const personRoles = [
    ...new Set(
      [
        ...normalized.matchAll(
          /\b(chief [a-z]+ officer|c[a-z]o|vp [a-z ]{2,20}|heads? of [a-z ]{2,25}|medical affairs|business development|clinical development|regulatory affairs|bioinformatics|computational biology|translational (?:research|medicine)|principal investigators?|key opinion leaders?|\bkols?\b|leaders?|executives?|directors?)\b/g,
        ),
      ].map((m) => m[1].trim()),
    ),
  ];

  const freshness = parseFreshness(normalized);

  // ── intent classification ──────────────────────────────────────────────
  const hasEntity =
    nctIds.length > 0 ||
    biomarkers.length > 0 ||
    assets.length > 0 ||
    companies.size > 0 ||
    indications.length > 0 ||
    pathways.length > 0;

  const mentionsTrial = /\b(trial|trials|study|studies|nct|recruit|enroll|phase|cohort|arm|endpoint)\b/i.test(normalized);
  const mentionsCompany = /\b(compan(?:y|ies)|sponsor|pipeline|competitor|partner(?:ship)?|licens\w+|biotech|pharma)\b/i.test(normalized);
  const mentionsPeople = personRoles.length > 0 || /\b(people|contact|contacts|stakeholder|person|who leads|who runs|who is the)\b/i.test(normalized);
  const mentionsSignal = /\b(signal|signals|news|announc\w+|press release|update|updates|changed|change|readout|approval|filing|financ\w+|raise|round)\b/i.test(normalized);

  // The Home recommendation flow — ONLY for an explicit "what should I…" style
  // prompt with NO searchable entity in it.
  const priorities =
    !hasEntity &&
    (/\bwhat should i (?:focus on|work on|do|prioriti[sz]e|look at)\b/.test(normalized) ||
      /\bwhat(?:'s| is) on my plate\b/.test(normalized) ||
      /\bwhere should i (?:start|focus)\b/.test(normalized) ||
      /\bmy (?:priorities|focus|day|agenda|to-?do)\b/.test(normalized) ||
      /\bwhat are my priorities\b/.test(normalized) ||
      /\bhelp me plan my day\b/.test(normalized));

  const intents: QueryIntents = {
    trials: !priorities && (mentionsTrial || nctIds.length > 0 || (hasEntity && !mentionsCompany && !mentionsPeople)),
    companies: !priorities && (mentionsCompany || (companies.size > 0 && !mentionsTrial && !mentionsPeople)),
    people: !priorities && mentionsPeople,
    // A signal/news word triggers the signals lane. A bare date window does too
    // ("recent Novartis"), but NOT when the query explicitly asks for trials —
    // "new KRAS trials this month" is trial discovery, not a news scan.
    signals: !priorities && (mentionsSignal || (freshness.wants && hasEntity && !mentionsTrial)),
    priorities,
  };
  // Guarantee at least one search lane when it isn't a priorities prompt.
  if (!priorities && !intents.trials && !intents.companies && !intents.people && !intents.signals) {
    intents.trials = true;
    intents.signals = true;
  }

  // residual ranking terms + preserved phrases
  const phrases = [
    ...biomarkers.map((b) => b.toLowerCase()),
    ...assets.map((a) => a.toLowerCase()),
    ...indications,
    ...[...companies].map((c) => c.toLowerCase()),
  ];
  const terms = [
    ...new Set(
      normalized
        .replace(/[^a-z0-9\s.\-/]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !CONTROL_WORDS.has(t) && !/^\d+$/.test(t)),
    ),
  ];

  return {
    raw: trimmed,
    normalized,
    nctIds: [...new Set(nctIds)],
    biomarkers: [...new Set(biomarkers)],
    assets,
    companies: [...companies],
    indications: [...new Set(indications)],
    pathways: [...new Set(pathways)],
    phases,
    statuses,
    personRoles,
    freshness,
    intents,
    terms,
    phrases: [...new Set(phrases)],
  };
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}
