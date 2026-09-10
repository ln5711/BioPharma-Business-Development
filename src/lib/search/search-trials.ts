import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trials } from "@/db/schema";
import { CtgovClient } from "@/integrations/clinicaltrials/client";
import { normalizeStudy } from "@/integrations/clinicaltrials/normalize";
import { ingestStudies } from "@/integrations/clinicaltrials/ingest";
import type { CtgovStudy } from "@/integrations/clinicaltrials/types";
import type { ParsedQuery, TrialPhase, TrialSearchResult, TrialStatus } from "./types";

const PHASE_LABEL: Record<TrialPhase, string> = {
  early_phase_1: "Early Phase 1",
  phase_1: "Phase 1",
  phase_1_2: "Phase 1/2",
  phase_2: "Phase 2",
  phase_2_3: "Phase 2/3",
  phase_3: "Phase 3",
  phase_4: "Phase 4",
  not_applicable: "N/A",
  unknown: "—",
};

/** our enum → the PHASE* tokens CT.gov's AREA[Phase] filter expects */
const PHASE_TO_CTGOV: Record<TrialPhase, string[]> = {
  early_phase_1: ["EARLY_PHASE1"],
  phase_1: ["PHASE1"],
  phase_1_2: ["PHASE1", "PHASE2"],
  phase_2: ["PHASE2"],
  phase_2_3: ["PHASE2", "PHASE3"],
  phase_3: ["PHASE3"],
  phase_4: ["PHASE4"],
  not_applicable: ["NA"],
  unknown: [],
};

const STATUS_TO_CTGOV: Record<TrialStatus, string> = {
  not_yet_recruiting: "NOT_YET_RECRUITING",
  recruiting: "RECRUITING",
  enrolling_by_invitation: "ENROLLING_BY_INVITATION",
  active_not_recruiting: "ACTIVE_NOT_RECRUITING",
  suspended: "SUSPENDED",
  terminated: "TERMINATED",
  completed: "COMPLETED",
  withdrawn: "WITHDRAWN",
  unknown: "",
};

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

interface Row {
  id: string;
  nctId: string;
  title: string | null;
  sponsorName: string | null;
  phase: string;
  status: string;
  interventionsRaw: { type: string; name: string }[];
  conditionsRaw: string[];
  eligibilityText: string | null;
  biomarkerRequirements: string[];
  commercialSummary: string | null;
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  serialSamplingMentions: boolean;
  lastCtgovUpdate: Date | null;
  firstPostedDate: Date | null;
}

function flagsOf(r: {
  molecularEligibility: boolean;
  ctdnaMentions: boolean;
  mrdMentions: boolean;
  ngsMentions: boolean;
  serialSamplingMentions: boolean;
}): string[] {
  const out: string[] = [];
  if (r.molecularEligibility) out.push("molecular eligibility");
  if (r.ctdnaMentions) out.push("ctDNA");
  if (r.mrdMentions) out.push("MRD");
  if (r.ngsMentions) out.push("NGS");
  if (r.serialSamplingMentions) out.push("serial sampling");
  return out;
}

// ── local (workspace) trial search ───────────────────────────────────────

async function searchLocal(
  tenantId: string,
  p: ParsedQuery,
  limit: number,
): Promise<Row[]> {
  const db = await getDb();
  const needles = [
    ...p.nctIds,
    ...p.phrases,
    ...p.biomarkers.map((b) => b.toLowerCase()),
    ...p.assets.map((a) => a.toLowerCase()),
    ...p.companies.map((c) => c.toLowerCase()),
    ...p.indications,
    ...p.terms,
  ];
  const uniq = [...new Set(needles.map((n) => n.trim()).filter((n) => n.length >= 2))];

  const matchers = uniq.flatMap((n) => {
    const a = likeArg(n);
    return [
      ilike(trials.nctId, a),
      ilike(trials.title, a),
      ilike(trials.sponsorName, a),
      ilike(trials.eligibilityText, a),
      ilike(trials.commercialSummary, a),
      sql`${trials.interventionsRaw}::text ilike ${a}`,
      sql`${trials.conditionsRaw}::text ilike ${a}`,
      sql`${trials.biomarkerRequirements}::text ilike ${a}`,
      sql`${trials.collaborators}::text ilike ${a}`,
    ];
  });

  const conds = [eq(trials.tenantId, tenantId)];
  if (matchers.length) conds.push(or(...matchers)!);
  if (p.phases.length) conds.push(inArray(trials.phase, p.phases));
  if (p.statuses.length) {
    // recruiting is often what people mean by "open" — include enrolling-by-invitation
    const wanted = new Set<TrialStatus>(p.statuses);
    if (wanted.has("recruiting")) wanted.add("enrolling_by_invitation");
    conds.push(inArray(trials.status, [...wanted]));
  }
  if (p.freshness.days != null) {
    const since = new Date(Date.now() - p.freshness.days * 86_400_000).toISOString();
    conds.push(sql`coalesce(${trials.lastCtgovUpdate}, ${trials.firstPostedDate}) >= ${since}::timestamptz`);
  }

  const rows = (await db
    .select({
      id: trials.id,
      nctId: trials.nctId,
      title: trials.title,
      sponsorName: trials.sponsorName,
      phase: trials.phase,
      status: trials.status,
      interventionsRaw: trials.interventionsRaw,
      conditionsRaw: trials.conditionsRaw,
      eligibilityText: trials.eligibilityText,
      biomarkerRequirements: trials.biomarkerRequirements,
      commercialSummary: trials.commercialSummary,
      molecularEligibility: trials.molecularEligibility,
      ctdnaMentions: trials.ctdnaMentions,
      mrdMentions: trials.mrdMentions,
      ngsMentions: trials.ngsMentions,
      serialSamplingMentions: trials.serialSamplingMentions,
      lastCtgovUpdate: trials.lastCtgovUpdate,
      firstPostedDate: trials.firstPostedDate,
    })
    .from(trials)
    .where(and(...conds))
    .orderBy(desc(sql`coalesce(${trials.lastCtgovUpdate}, ${trials.firstPostedDate}, ${trials.firstSeenAt})`))
    .limit(limit)) as Row[];
  return rows;
}

// ── live ClinicalTrials.gov search ───────────────────────────────────────

function buildCtgovTerm(p: ParsedQuery): string {
  const quote = (s: string) => (/\s/.test(s) ? `"${s}"` : s);
  const core = [...p.biomarkers, ...p.assets].map(quote);
  const comp = p.companies.map(quote);
  const residual = p.terms
    .filter(
      (t) =>
        !p.biomarkers.some((b) => b.toLowerCase().includes(t)) &&
        !p.assets.some((a) => a.toLowerCase().includes(t)) &&
        !p.companies.some((c) => c.toLowerCase().includes(t)) &&
        !p.indications.some((i) => i.includes(t)),
    )
    .slice(0, 3);

  let term = "";
  if (core.length) term = `(${core.join(" OR ")})`;
  if (comp.length) term = term ? `${term} AND (${comp.join(" OR ")})` : `(${comp.join(" OR ")})`;
  if (!term && residual.length) term = residual.map(quote).join(" ");
  return term;
}

async function searchLive(
  p: ParsedQuery,
  limit: number,
): Promise<{ studies: CtgovStudy[]; error: string | null }> {
  const client = new CtgovClient();

  // Exact NCT lookups take priority.
  if (p.nctIds.length) {
    const out: CtgovStudy[] = [];
    for (const id of p.nctIds.slice(0, 5)) {
      try {
        const s = await client.fetchOne(id);
        if (s) out.push(s);
      } catch {
        /* keep going */
      }
    }
    return { studies: out, error: null };
  }

  const term = buildCtgovTerm(p);
  const conditions = p.indications.slice(0, 4);
  if (!term && !conditions.length) return { studies: [], error: null };

  const statuses = [
    ...new Set(
      p.statuses.map((s) => STATUS_TO_CTGOV[s]).filter(Boolean),
    ),
  ];
  const advanced: string[] = [];
  if (p.freshness.days != null) {
    const since = new Date(Date.now() - p.freshness.days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    advanced.push(`AREA[LastUpdatePostDate]RANGE[${since},MAX]`);
  }
  const phaseTokens = [...new Set(p.phases.flatMap((ph) => PHASE_TO_CTGOV[ph]))];

  const studies: CtgovStudy[] = [];
  const deadline = Date.now() + 12_000;
  try {
    for await (const s of client.studies({
      terms: term ? [term] : [],
      conditions,
      statuses: statuses.length ? statuses : undefined,
      phases: phaseTokens.length ? phaseTokens : undefined,
      advanced: advanced.length ? advanced : undefined,
      maxStudies: limit,
    })) {
      studies.push(s);
      if (studies.length >= limit || Date.now() > deadline) break;
    }
  } catch (err) {
    return { studies, error: (err as Error).message.slice(0, 160) };
  }
  return { studies, error: null };
}

// ── ranking ──────────────────────────────────────────────────────────────

function scoreTrial(p: ParsedQuery, r: TrialSearchResult): number {
  let s = 0;
  const hay = `${r.nctId} ${r.title} ${r.sponsor ?? ""} ${r.interventions.join(" ")} ${r.conditions.join(" ")} ${r.biomarkers.join(" ")} ${r.summary ?? ""}`.toLowerCase();

  if (p.nctIds.includes(r.nctId)) s += 100;
  for (const a of p.assets) if (hay.includes(a.toLowerCase())) s += 30;
  // biomarker match — a STRONG-field hit (title / sponsor / intervention /
  // condition) is what ranks a trial up. A mention only in eligibility-derived
  // biomarker_requirements or the free-text summary is a WEAK boost — never a
  // strong signal on its own — and a biomarker named nowhere is demoted.
  const strongF =
    `${r.title} ${r.sponsor ?? ""} ${r.interventions.join(" ")} ${r.conditions.join(" ")}`.toLowerCase();
  const weakF = `${r.biomarkers.join(" ")} ${r.summary ?? ""}`.toLowerCase();
  for (const b of p.biomarkers) {
    const bl = b.toLowerCase();
    if (strongF.includes(bl)) s += 26;
    else if (weakF.includes(bl)) s += 4;
    else s -= 12;
  }
  for (const c of p.companies) if ((r.sponsor ?? "").toLowerCase().includes(c.toLowerCase())) s += 25;
  else for (const c of p.companies) if (hay.includes(c.toLowerCase())) s += 10;
  for (const ind of p.indications) if (hay.includes(ind.split(" ")[0])) s += 12;
  for (const t of p.terms) if (hay.includes(t)) s += 3;

  if (p.statuses.length && p.statuses.map(String).includes(r.status)) s += 8;
  if (!p.statuses.length && r.status === "recruiting") s += 5;
  if (p.phases.length && p.phases.map(String).includes(r.phase)) s += 8;

  // recency
  const upd = r.lastUpdate ? Date.parse(r.lastUpdate) : 0;
  if (upd) {
    const ageDays = (Date.now() - upd) / 86_400_000;
    if (ageDays < 7) s += 14;
    else if (ageDays < 30) s += 10;
    else if (ageDays < 120) s += 5;
    else if (ageDays < 365) s += 1;
    else if (ageDays > 1460) s -= 14;
    else if (ageDays > 730) s -= 7;
  }
  if (r.status === "completed" || r.status === "terminated") s -= 6;
  if (r.inWorkspace) s += 4;
  return s;
}

function rowToResult(r: Row, inWorkspace: boolean, source: TrialSearchResult["source"]): TrialSearchResult {
  const phase = (r.phase as TrialPhase) ?? "unknown";
  const status = (r.status as TrialStatus) ?? "unknown";
  return {
    kind: "trial",
    nctId: r.nctId,
    title: r.title ?? r.nctId,
    sponsor: r.sponsorName,
    phase,
    phaseLabel: PHASE_LABEL[phase] ?? "—",
    status,
    statusLabel: status.replace(/_/g, " "),
    interventions: (r.interventionsRaw ?? []).map((i) => i.name).filter(Boolean).slice(0, 5),
    conditions: (r.conditionsRaw ?? []).slice(0, 5),
    biomarkers: (r.biomarkerRequirements ?? []).slice(0, 4),
    flags: flagsOf(r),
    summary: r.commercialSummary ?? null,
    lastUpdate: iso(r.lastCtgovUpdate),
    firstPosted: iso(r.firstPostedDate),
    source,
    inWorkspace,
    url: `https://clinicaltrials.gov/study/${r.nctId}`,
    recordUrl: `/trials/${r.nctId}`,
    score: 0,
  };
}

function normalizedToRow(s: CtgovStudy): Row | null {
  let n;
  try {
    n = normalizeStudy(s);
  } catch {
    return null;
  }
  if (!n.nctId) return null;
  return {
    id: n.nctId,
    nctId: n.nctId,
    title: n.title,
    sponsorName: n.sponsorName,
    phase: n.phase,
    status: n.status,
    interventionsRaw: n.interventionsRaw,
    conditionsRaw: n.conditionsRaw,
    eligibilityText: n.eligibilityText,
    biomarkerRequirements: n.biomarkerRequirements,
    commercialSummary: n.commercialSummary || null,
    molecularEligibility: n.molecularEligibility,
    ctdnaMentions: n.ctdnaMentions,
    mrdMentions: n.mrdMentions,
    ngsMentions: n.ngsMentions,
    serialSamplingMentions: n.serialSamplingMentions,
    lastCtgovUpdate: n.lastCtgovUpdate,
    firstPostedDate: n.firstPostedDate,
  };
}

export interface HybridTrialOptions {
  /** also query ClinicalTrials.gov live (default true) */
  live?: boolean;
  /** persist useful live results back to the workspace (default false) */
  persist?: boolean;
  tenantId: string;
  limit?: number;
}

export interface HybridTrialResult {
  results: TrialSearchResult[];
  localCount: number;
  liveCount: number;
  ctgovQueried: boolean;
  ctgovError: string | null;
  upserted: number;
}

/**
 * Hybrid trial search: local workspace first, then live ClinicalTrials.gov for
 * explicit trial queries. Results are merged and de-duplicated by NCT id; the
 * user never has to know which store a row came from. Live results can be
 * persisted so they are locally searchable next time.
 */
export async function searchTrialsHybrid(
  p: ParsedQuery,
  opts: HybridTrialOptions,
): Promise<HybridTrialResult> {
  const limit = opts.limit ?? 20;
  const local = await searchLocal(opts.tenantId, p, Math.max(limit, 30)).catch(() => [] as Row[]);
  const localByNct = new Map(local.map((r) => [r.nctId, r]));

  let liveStudies: CtgovStudy[] = [];
  let ctgovError: string | null = null;
  let ctgovQueried = false;
  const liveAllowed = opts.live !== false && process.env.SEARCH_DISABLE_LIVE !== "1";
  const wantLive = liveAllowed && (p.intents.trials || p.nctIds.length > 0);
  if (wantLive) {
    ctgovQueried = true;
    const r = await searchLive(p, Math.max(limit, 20));
    liveStudies = r.studies;
    ctgovError = r.error;
  }

  const merged = new Map<string, TrialSearchResult>();
  for (const r of local) merged.set(r.nctId, rowToResult(r, true, "workspace"));
  for (const s of liveStudies) {
    const row = normalizedToRow(s);
    if (!row) continue;
    if (merged.has(row.nctId)) {
      // keep the workspace row but take the fresher CT.gov update date
      const existing = merged.get(row.nctId)!;
      const liveUpd = iso(row.lastCtgovUpdate);
      if (liveUpd && (!existing.lastUpdate || liveUpd > existing.lastUpdate)) {
        existing.lastUpdate = liveUpd;
      }
      continue;
    }
    merged.set(row.nctId, rowToResult(row, localByNct.has(row.nctId), "clinicaltrials.gov"));
  }

  // Relevance gate: when the query names concrete entities, a result must
  // actually be about them — this keeps ClinicalTrials.gov's loose free-text
  // matches (a trial that merely *excludes* KRAS, say) and off-target workspace
  // rows out of the answer. When BOTH a company and a science entity are named,
  // require BOTH ("Amgen KRAS" → an Amgen-sponsored KRAS trial, not any KRAS
  // trial). Exact NCT ids always pass.
  const sciWants = [
    ...p.biomarkers.map((b) => b.toLowerCase()),
    ...p.assets.map((a) => a.toLowerCase()),
    ...p.indications,
  ];
  const coWants = p.companies.map((c) => c.toLowerCase());
  const nctSet = new Set(p.nctIds);
  const hit = (needle: string, hay: string) => {
    if (needle.includes(" ")) return hay.includes(needle) || hay.includes(needle.split(" ")[0]);
    return new RegExp(`(?<![a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(hay);
  };
  const gated = [...merged.values()].filter((r) => {
    if (!sciWants.length && !coWants.length) return true;
    if (nctSet.has(r.nctId)) return true;
    // STRONG identity fields only: title, sponsor, intervention/asset, condition.
    // Eligibility-derived text (`r.biomarkers` = biomarker_requirements) and the
    // free-text `r.summary` are NOT enough on their own — a trial that merely
    // lists KRAS among its exclusion criteria must not pass a "KRAS" query.
    const strongHay =
      `${r.title} ${r.sponsor ?? ""} ${r.interventions.join(" ")} ${r.conditions.join(" ")}`.toLowerCase();
    const coHay = `${r.title} ${r.sponsor ?? ""}`.toLowerCase();
    const sciOk = !sciWants.length || sciWants.some((w) => hit(w, strongHay));
    const coOk = !coWants.length || coWants.some((w) => hit(w, coHay));
    return sciOk && coOk;
  });

  const results = (gated.length ? gated : [...merged.values()])
    .map((r) => ({ ...r, score: scoreTrial(p, r) }))
    .sort((a, b) => b.score - a.score || (b.lastUpdate ?? "").localeCompare(a.lastUpdate ?? ""))
    .slice(0, limit);

  // opportunistic persistence of live-only trials that surfaced in the results
  let upserted = 0;
  if (opts.persist && liveStudies.length) {
    const keepNct = new Set(results.filter((r) => r.source === "clinicaltrials.gov").map((r) => r.nctId));
    const toSave = liveStudies.filter((s) => {
      const n = s.protocolSection?.identificationModule?.nctId;
      return n && keepNct.has(n.toUpperCase());
    });
    if (toSave.length) {
      const db = await getDb();
      try {
        const stats = await ingestStudies(db, opts.tenantId, toSave, { cap: 12 });
        upserted = stats.newTrials + stats.updatedTrials;
      } catch {
        /* best-effort */
      }
    }
  }

  return {
    results,
    localCount: local.length,
    liveCount: liveStudies.length,
    ctgovQueried,
    ctgovError,
    upserted,
  };
}

/**
 * Bootstrap a workspace that has never ingested a trial: pull a batch of
 * recently-updated interventional oncology trials straight from
 * ClinicalTrials.gov, persist a bounded number, and return normalized results
 * to render immediately. No seed data, no watchlist required.
 */
export async function bootstrapOncologyTrials(
  tenantId: string,
  opts: { fetch?: number; persist?: number } = {},
): Promise<{ results: TrialSearchResult[]; persisted: number; error: string | null }> {
  const fetchN = Math.min(opts.fetch ?? 40, 60);
  const persistN = Math.min(opts.persist ?? 20, fetchN);
  const client = new CtgovClient();
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);

  const studies: CtgovStudy[] = [];
  const deadline = Date.now() + 15_000;
  let error: string | null = null;
  try {
    for await (const s of client.studies({
      terms: [],
      conditions: ["cancer OR neoplasm OR tumor OR carcinoma OR lymphoma OR leukemia"],
      statuses: ["RECRUITING", "ACTIVE_NOT_RECRUITING", "NOT_YET_RECRUITING"],
      advanced: [
        `AREA[LastUpdatePostDate]RANGE[${since},MAX]`,
        "AREA[StudyType]INTERVENTIONAL",
      ],
      maxStudies: fetchN,
    })) {
      studies.push(s);
      if (studies.length >= fetchN || Date.now() > deadline) break;
    }
  } catch (err) {
    error = (err as Error).message.slice(0, 160);
  }

  let persisted = 0;
  if (studies.length) {
    const db = await getDb();
    try {
      const stats = await ingestStudies(db, tenantId, studies, { cap: persistN });
      persisted = stats.newTrials + stats.updatedTrials;
    } catch {
      /* best-effort — still render live below */
    }
  }

  const results = studies
    .map((s) => normalizedToRow(s))
    .filter((r): r is Row => !!r)
    .map((r) => rowToResult(r, false, "clinicaltrials.gov"))
    .sort((a, b) => (b.lastUpdate ?? "").localeCompare(a.lastUpdate ?? ""));
  return { results, persisted, error };
}
