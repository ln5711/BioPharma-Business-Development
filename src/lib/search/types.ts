/**
 * Shared types for the newwin search service.
 *
 * The service is deliberately SEPARATE from watchlist ingestion: a search may
 * range across the entire public ClinicalTrials.gov universe, while a watchlist
 * only decides what newwin proactively monitors and diffs for change alerts.
 */

/** Our internal trial-phase enum values. */
export type TrialPhase =
  | "early_phase_1"
  | "phase_1"
  | "phase_1_2"
  | "phase_2"
  | "phase_2_3"
  | "phase_3"
  | "phase_4"
  | "not_applicable"
  | "unknown";

/** Our internal overall-status enum values. */
export type TrialStatus =
  | "not_yet_recruiting"
  | "recruiting"
  | "enrolling_by_invitation"
  | "active_not_recruiting"
  | "suspended"
  | "terminated"
  | "completed"
  | "withdrawn"
  | "unknown";

/** What the user is asking newwin to look at. Multiple can be true. */
export interface QueryIntents {
  trials: boolean;
  companies: boolean;
  people: boolean;
  signals: boolean;
  /** The Home "what should I focus on" recommendation flow. */
  priorities: boolean;
}

/** Freshness window the user asked for, if any. */
export interface Freshness {
  /** Look-back window in days (today = 1, this week = 7, …). null = no bound. */
  days: number | null;
  /** The user used a recency word ("today", "latest", "updated", "recent"). */
  wants: boolean;
  /** They specifically said "updated" / "changed" — prefer CT.gov update date. */
  updatedEmphasis: boolean;
  /**
   * Which CT.gov date the window applies to:
   *  - "posted"  → Study First Posted (a genuinely NEW trial)  — "new … today"
   *  - "updated" → Last Update Posted (real CT.gov activity)     — "… updated today"
   *  - "any"     → most recent of the two, sorted by recency     — "latest …"
   */
  kind: "posted" | "updated" | "any";
  /** Human label for the UI ("today", "this week", …). */
  label: string | null;
}

/** Deterministic parse of a raw search string. No LLM. */
export interface ParsedQuery {
  raw: string;
  /** lower-cased, whitespace-collapsed */
  normalized: string;
  nctIds: string[];
  /** genes / targets / biomarkers, upper-cased, e.g. "KRAS", "KRAS G12D", "HER2" */
  biomarkers: string[];
  /** drug / asset names + development codes, e.g. "RMC-6236", "sotorasib" */
  assets: string[];
  /** organisation / sponsor names, e.g. "Amgen", "Novartis" */
  companies: string[];
  /** disease / indication terms, e.g. "pancreatic cancer", "NSCLC" */
  indications: string[];
  /** pathway words, e.g. "RAS", "MAPK" */
  pathways: string[];
  phases: TrialPhase[];
  statuses: TrialStatus[];
  personRoles: string[];
  freshness: Freshness;
  intents: QueryIntents;
  /** meaningful residual terms for ranking (control words stripped) */
  terms: string[];
  /** every scientific phrase we want to keep intact for matching */
  phrases: string[];
}

export interface TrialSearchResult {
  kind: "trial";
  nctId: string;
  title: string;
  sponsor: string | null;
  phase: TrialPhase;
  phaseLabel: string;
  status: TrialStatus;
  statusLabel: string;
  interventions: string[];
  conditions: string[];
  biomarkers: string[];
  /** short testing-language flags: "molecular eligibility", "ctDNA", … */
  flags: string[];
  summary: string | null;
  /** ClinicalTrials.gov "Last Update Posted" */
  lastUpdate: string | null;
  /** ClinicalTrials.gov "Study First Posted" */
  firstPosted: string | null;
  /** whether this row's CT.gov recency is a fresh posting or a later update */
  recencyKind: "posted" | "updated";
  /** where this row was resolved from */
  source: "workspace" | "clinicaltrials.gov";
  /** true when the row also exists in the tenant's workspace */
  inWorkspace: boolean;
  url: string;
  recordUrl: string;
  score: number;
}

export interface CompanySearchResult {
  kind: "company";
  id: string;
  name: string;
  type: string | null;
  ticker: string | null;
  recordUrl: string;
  score: number;
}

export interface SignalSearchResult {
  kind: "signal";
  id: string;
  headline: string;
  summary: string;
  signalType: string;
  company: string | null;
  nctId: string | null;
  eventDate: string | null;
  recordUrl: string;
  sourceUrl: string | null;
  score: number;
}

export interface PersonSearchResult {
  kind: "person";
  id: string;
  name: string;
  title: string | null;
  role: string | null;
  company: string | null;
  recordUrl: string;
  score: number;
}

export interface SearchResult {
  parsed: ParsedQuery;
  trials: TrialSearchResult[];
  companies: CompanySearchResult[];
  signals: SignalSearchResult[];
  people: PersonSearchResult[];
  /** diagnostics — never contains secrets */
  meta: {
    tookMs: number;
    localTrialCount: number;
    liveTrialCount: number;
    ctgovQueried: boolean;
    ctgovError: string | null;
    upserted: number;
  };
}
