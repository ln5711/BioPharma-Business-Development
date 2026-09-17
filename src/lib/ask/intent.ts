import "server-only";
import { z } from "zod";
import { anthropic } from "@/lib/llm";

/**
 * Structured interpretation of an Ask newwin question. Produced by Claude when
 * available, otherwise by a deterministic parser. Page context can *fill gaps*
 * (e.g. which trial you're looking at) but an explicit company / topic / filter
 * in the question always wins.
 */
export const IntentSchema = z.object({
  /**
   * newwin is a research assistant first: `public_research` is the DEFAULT for
   * anything about the outside world. `personal` is only for the signed-in
   * user's own saved records. `compare_trials` compares specific NCT ids.
   */
  intent: z.enum(["public_research", "personal", "compare_trials", "draft_outreach"]),
  /** For `personal`: which of the user's own things they're asking about. */
  personalKind: z
    .enum(["priorities", "contacts", "overdue_tasks", "drafts", "tasks", "general"])
    .default("general"),
  companies: z.array(z.string().max(120)).max(6).default([]),
  assets: z.array(z.string().max(120)).max(6).default([]),
  biomarkers: z.array(z.string().max(80)).max(8).default([]),
  indications: z.array(z.string().max(120)).max(6).default([]),
  /** Free-text topic words like "oncology", "pipeline", "regulatory". */
  topics: z.array(z.string().max(60)).max(6).default([]),
  /** e.g. "leaders", "CMO", "bioinformatics", "medical affairs". */
  personRoles: z.array(z.string().max(60)).max(4).default([]),
  phases: z
    .array(z.enum(["1", "1/2", "2", "2/3", "3", "4"]))
    .max(6)
    .default([]),
  statuses: z
    .array(z.enum(["recruiting", "not_yet_recruiting", "active", "completed", "terminated"]))
    .max(6)
    .default([]),
  nctIds: z.array(z.string().regex(/^NCT\d{8}$/i)).max(6).default([]),
  /** Days back the user is asking about; null = no explicit timeframe. */
  timeframeDays: z.number().int().positive().max(3650).nullable().default(null),
  /**
   * True when the query clearly wants CURRENT news / announcements (steers the
   * research toward recency). Public research always runs regardless.
   */
  wantsExternalResearch: z.boolean().default(false),
  /** For follow-ups that reference an earlier result, e.g. "the second one". */
  refersToPreviousResult: z.number().int().positive().max(20).nullable().default(null),
  /** Short restatement of what to answer. */
  normalizedQuestion: z.string().max(400).default(""),
});
export type AskIntent = z.infer<typeof IntentSchema>;

export interface IntentContext {
  /** From the page path: an account being viewed. */
  contextCompany?: { id: string; name: string } | null;
  /** From the page path: a trial being viewed. */
  contextNctId?: string | null;
  /** Prior turns in this conversation (most recent last). */
  history?: { role: "user" | "assistant"; content: string }[];
}

const PHASE_MAP: Record<string, string> = {
  "phase 1": "1",
  "phase i": "1",
  "phase 1/2": "1/2",
  "phase 2": "2",
  "phase ii": "2",
  "phase 2/3": "2/3",
  "phase 3": "3",
  "phase iii": "3",
  "phase 4": "4",
};

/** Deterministic best-effort parse — always runs, and is the fallback. */
export function parseIntentHeuristic(query: string, ctx: IntentContext): AskIntent {
  const q = query.trim();
  const lower = q.toLowerCase();

  const nctIds = [...q.matchAll(/NCT\d{8}/gi)].map((m) => m[0].toUpperCase());
  const phases = Object.entries(PHASE_MAP)
    .filter(([k]) => lower.includes(k))
    .map(([, v]) => v);
  if (/only phase 2\b|phase 2 only/.test(lower) && !phases.includes("2")) phases.push("2");

  const statuses: string[] = [];
  if (/recruit/.test(lower)) statuses.push("recruiting");
  if (/not yet recruit/.test(lower)) statuses.push("not_yet_recruiting");
  if (/\bactive\b/.test(lower)) statuses.push("active");
  if (/complet/.test(lower)) statuses.push("completed");
  if (/terminat/.test(lower)) statuses.push("terminated");

  let timeframeDays: number | null = null;
  if (/\btoday\b|last 24|overnight/.test(lower)) timeframeDays = 1;
  else if (/this week|last 7|past week/.test(lower)) timeframeDays = 7;
  else if (/this month|last 30|past month/.test(lower)) timeframeDays = 30;
  else if (/this quarter|last 90/.test(lower)) timeframeDays = 90;
  const m = /last (\d{1,3}) days?/.exec(lower);
  if (m) timeframeDays = Math.min(3650, Number(m[1]));

  // Companies: "at/for/about <Proper Noun>", "<Proper Noun> news/trial/update",
  // then any other capitalised token that is not a sentence-initial stopword.
  const CAP_STOP = new Set([
    "any", "what", "whats", "which", "who", "show", "find", "list", "get",
    "compare", "draft", "the", "a", "an", "did", "does", "do", "is", "are",
    "has", "have", "give", "tell", "only", "phase", "recruiting", "active",
    "trial", "trials", "study", "studies", "new", "recent", "latest", "all",
    "search", "look", "in", "on", "for", "about", "me", "us", "our", "with",
  ]);
  const companies = new Set<string>();
  // An all-caps token with no lowercase letter is a gene / biomarker (KRAS,
  // PD-L1, MSI-H), never a company name. Also strip leading verb/filler words.
  const asCompany = (raw: string): string | null => {
    let parts = raw.trim().split(/\s+/);
    while (parts.length && CAP_STOP.has(parts[0].toLowerCase().replace(/[^a-z]/g, ""))) {
      parts = parts.slice(1);
    }
    const s = parts.join(" ");
    if (!s || !/[a-z]/.test(s) || /^NCT\d/i.test(s)) return null;
    return s;
  };
  for (const mm of q.matchAll(
    /(?:at|for|about|from|by)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,3})/g,
  )) {
    const c = asCompany(mm[1]);
    if (c) companies.add(c);
  }
  for (const mm of q.matchAll(
    /\b([A-Z][A-Za-z0-9&.\-]{1,}(?:\s+[A-Za-z0-9&.\-]+){0,2})\s+(?:news|update|updates|trial|trials|announce\w*|develop\w*|pipeline)\b/g,
  )) {
    const c = asCompany(mm[1]);
    if (c) companies.add(c);
  }
  for (const w of q.split(/\s+/)) {
    const clean = w.replace(/[^A-Za-z0-9&.\-]/g, "");
    if (clean.length < 3 || !/^[A-Z]/.test(clean)) continue;
    if (CAP_STOP.has(clean.toLowerCase())) continue;
    if (/^NCT\d/i.test(clean)) continue;
    // Keep only tokens that contain a lowercase letter — real names like
    // "Novartis", "AstraZeneca". Drops all-caps genes/biomarkers (KRAS, PD-L1).
    if (!/[a-z]/.test(clean)) continue;
    companies.add(clean);
  }
  if (ctx.contextCompany && companies.size === 0) companies.add(ctx.contextCompany.name);

  // Split trailing generic descriptors off a company name:
  // "Novartis oncology" → company "Novartis" + topic "oncology".
  const TOPIC_WORDS = new Set([
    "oncology", "pharma", "pharmaceutical", "pharmaceuticals", "therapeutics",
    "biosciences", "bioscience", "biopharma", "biotech", "biotechnology",
    "pipeline", "regulatory", "financing", "partnerships", "partnership",
    "leadership", "diagnostics", "genomics", "immunology", "hematology",
  ]);
  const topics = new Set<string>();
  for (const raw of [...companies]) {
    const parts = raw.split(/\s+/);
    while (parts.length > 1 && TOPIC_WORDS.has(parts[parts.length - 1].toLowerCase())) {
      topics.add(parts.pop()!.toLowerCase());
    }
    if (parts.join(" ") !== raw) {
      companies.delete(raw);
      if (parts.length) companies.add(parts.join(" "));
    }
  }
  for (const w of lower.split(/\s+/)) {
    const c = w.replace(/[^a-z]/g, "");
    if (TOPIC_WORDS.has(c)) topics.add(c);
  }

  const biomarkers = [
    ...new Set(
      [...q.matchAll(/\b(KRAS(?:\s?G12[CD])?|NRAS|HRAS|EGFR|ALK|ROS1|MET|RET|BRAF|HER2|NTRK|FGFR|IDH1|IDH2|BRCA|MSI-H|TMB|PD-L1|ctDNA|MRD)\b/gi)].map(
        (mm) => mm[1].toUpperCase(),
      ),
    ),
  ];
  const indications = [
    ...new Set(
      [
        ...q.matchAll(
          /\b(pancreatic|colorectal|CRC|NSCLC|lung|breast|prostate|ovarian|melanoma|glioblastoma|AML|leukemia|lymphoma|myeloma|bladder|gastric|hepatocellular|cholangiocarcinoma)\b/gi,
        ),
      ].map((mm) => mm[1].toLowerCase()),
    ),
  ];

  const refersMatch =
    /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\b/.exec(lower);
  const ordinal: Record<string, number> = {
    first: 1,
    "1st": 1,
    second: 2,
    "2nd": 2,
    third: 3,
    "3rd": 3,
    fourth: 4,
    "4th": 4,
    fifth: 5,
    "5th": 5,
  };
  const refersToPreviousResult = refersMatch ? ordinal[refersMatch[1]] ?? null : null;

  // Person-role words for "who leads X" style queries.
  const personRoles = [
    ...new Set(
      [
        ...q.matchAll(
          /\b(leaders?|executives?|heads? of [a-z ]{2,30}|chief [a-z ]{2,20}|c[a-z]o\b|vp[a-z ]{0,20}|directors?|bioinformatics|medical affairs|business development|clinical development|regulatory affairs|principal investigators?)\b/gi,
        ),
      ].map((mm) => mm[1].toLowerCase().trim()),
    ),
  ].filter((r) => r && r !== "leaders" ? true : true);

  // ── classify ────────────────────────────────────────────────────────────
  // Default: everything about the outside world is public research.
  let intent: AskIntent["intent"] = "public_research";
  let personalKind: AskIntent["personalKind"] = "general";

  const isPersonal =
    /\bmy\b/.test(lower) ||
    /\b(assigned to me|i (saved|added|logged|drafted))\b/.test(lower) ||
    (/\boverdue\b/.test(lower) && /follow.?ups?|tasks?|outreach/.test(lower));

  if (/\b(compare|versus|vs\.?)\b/.test(lower) || nctIds.length >= 2) {
    intent = "compare_trials";
  } else if (/draft (an? )?(email|outreach|message|note)/.test(lower)) {
    intent = "draft_outreach";
  } else if (isPersonal) {
    intent = "personal";
    if (/\boverdue\b|follow.?ups?/.test(lower)) personalKind = "overdue_tasks";
    else if (/\bpriorit/.test(lower)) personalKind = "priorities";
    else if (/\b(contact|stakeholder|relationship)/.test(lower)) personalKind = "contacts";
    else if (/\b(draft|drafted)/.test(lower)) personalKind = "drafts";
    else if (/\btask/.test(lower)) personalKind = "tasks";
  }

  // A trial page + "what changed" → compare that trial.
  if (ctx.contextNctId && intent === "public_research" && /(chang|updat|recent|new)/.test(lower)) {
    intent = "compare_trials";
    if (!nctIds.includes(ctx.contextNctId)) nctIds.push(ctx.contextNctId);
  }

  return IntentSchema.parse({
    intent,
    personalKind,
    companies: [...companies],
    assets: [],
    biomarkers,
    indications,
    topics: [...topics],
    personRoles,
    phases,
    statuses,
    nctIds,
    timeframeDays,
    wantsExternalResearch:
      /latest|newest|recent(ly)?|this (week|month|quarter)|today|breaking|just announced|press release|news\b/.test(
        lower,
      ),
    refersToPreviousResult,
    normalizedQuestion: q.slice(0, 400),
  });
}

/**
 * Extract intent with Claude when configured; otherwise the heuristic. The
 * heuristic result is passed to Claude as a hint and used verbatim on any
 * model/parse failure.
 */
export async function extractIntent(
  query: string,
  ctx: IntentContext,
  signal?: AbortSignal,
): Promise<{ intent: AskIntent; source: "model" | "heuristic" }> {
  const heuristic = parseIntentHeuristic(query, ctx);
  const client = anthropic();
  if (!client) return { intent: heuristic, source: "heuristic" };

  const historyText = (ctx.history ?? [])
    .slice(-6)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

  try {
    const intent = await client.generateObject({
      system:
        "You extract structured search intent for newwin, an oncology research assistant. " +
        "newwin is a RESEARCH ASSISTANT FIRST: default `intent` to \"public_research\" for anything about the outside world (a company, drug, biomarker, disease, people at a company, or a general question) — even a single word like \"KRAS\". " +
        "Use \"personal\" ONLY when the user asks about their OWN saved things ('my priorities', 'my contacts', 'overdue follow-ups'); set personalKind accordingly. " +
        "Use \"compare_trials\" when comparing specific NCT ids. Use \"draft_outreach\" for 'draft an email…'. " +
        "companies holds ONLY the organisation name ('Novartis'); put descriptors ('oncology', 'pipeline', 'regulatory', 'pharma') in topics. Put role words ('leaders', 'CMO', 'bioinformatics', 'medical affairs') in personRoles. " +
        "Do not invent entities that are not present. timeframeDays: 1 today, 7 this week, 30 this month, else null. " +
        "wantsExternalResearch=true when the query wants CURRENT news / latest / recent / press releases.",
      prompt:
        `Question: ${query}\n` +
        (ctx.contextCompany ? `Page context: viewing account "${ctx.contextCompany.name}"\n` : "") +
        (ctx.contextNctId ? `Page context: viewing trial ${ctx.contextNctId}\n` : "") +
        (historyText ? `Recent conversation:\n${historyText}\n` : "") +
        `Heuristic guess (correct it if wrong): ${JSON.stringify(heuristic)}`,
      schema: IntentSchema,
      temperature: 0,
      signal,
      timeoutMs: 20_000,
    });
    // Never let the model drop an NCT id the user literally typed.
    for (const n of heuristic.nctIds) if (!intent.nctIds.includes(n)) intent.nctIds.push(n);
    for (const t of heuristic.topics) if (!intent.topics.includes(t)) intent.topics.push(t);
    for (const r of heuristic.personRoles) if (!intent.personRoles.includes(r)) intent.personRoles.push(r);
    // Defensive: strip any descriptor the model left glued onto a company name.
    intent.companies = intent.companies.map((c) => {
      const parts = c.split(/\s+/);
      while (parts.length > 1 && heuristic.topics.includes(parts[parts.length - 1].toLowerCase())) {
        parts.pop();
      }
      return parts.join(" ");
    });
    intent.wantsExternalResearch = intent.wantsExternalResearch || heuristic.wantsExternalResearch;
    // A "personal" classification is only trusted when the heuristic also saw a
    // first-person cue — otherwise default back to public research.
    if (intent.intent === "personal" && heuristic.intent !== "personal") {
      intent.intent = "public_research";
    }
    return { intent: IntentSchema.parse(intent), source: "model" };
  } catch {
    return { intent: heuristic, source: "heuristic" };
  }
}
