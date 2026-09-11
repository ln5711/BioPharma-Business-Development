import "server-only";
import { parseQuery } from "./parse-query";
import { searchTrialsHybrid } from "./search-trials";
import { searchSignalsService } from "./search-signals";
import { searchOrganizationsService } from "./search-organizations";
import { searchPeopleService } from "./search-people";
import type { ParsedQuery, SearchResult } from "./types";

export interface RunSearchOptions {
  tenantId: string;
  /** query ClinicalTrials.gov live for trial intents (default true) */
  live?: boolean;
  /** persist useful live CT.gov trials back to the workspace (default true) */
  persist?: boolean;
  trialLimit?: number;
}

/**
 * The newwin search service entry point.
 *
 * Parses the raw string deterministically, then runs only the entity lanes the
 * query actually calls for, in parallel. Trials use a hybrid local + live
 * ClinicalTrials.gov search so results are never limited to what was previously
 * ingested. Nothing here depends on a watchlist.
 */
export async function runSearch(
  raw: string,
  opts: RunSearchOptions,
): Promise<SearchResult> {
  const t0 = Date.now();
  const parsed: ParsedQuery = parseQuery(raw);
  const { tenantId } = opts;

  const wantTrials = parsed.intents.trials || parsed.nctIds.length > 0;
  const wantCompanies = parsed.intents.companies || parsed.companies.length > 0;
  // The workspace-signals lane cannot honour trial-structural constraints
  // (phase, recruiting status) — so it does not run for a query that carries
  // them. It stays for "what changed in KRAS this week" style news queries.
  const wantSignals =
    parsed.intents.signals && parsed.phases.length === 0 && parsed.statuses.length === 0;
  const wantPeople = parsed.intents.people;

  const [trialRes, companies, signals, people] = await Promise.all([
    wantTrials
      ? searchTrialsHybrid(parsed, {
          tenantId,
          live: opts.live,
          persist: opts.persist ?? true,
          limit: opts.trialLimit ?? 20,
        })
      : Promise.resolve(null),
    wantCompanies
      ? searchOrganizationsService(tenantId, parsed).catch(() => [])
      : Promise.resolve([]),
    wantSignals
      ? searchSignalsService(tenantId, parsed).catch(() => [])
      : Promise.resolve([]),
    wantPeople
      ? searchPeopleService(tenantId, parsed).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    parsed,
    trials: trialRes?.results ?? [],
    companies,
    signals,
    people,
    meta: {
      tookMs: Date.now() - t0,
      localTrialCount: trialRes?.localCount ?? 0,
      liveTrialCount: trialRes?.liveCount ?? 0,
      ctgovQueried: trialRes?.ctgovQueried ?? false,
      ctgovError: trialRes?.ctgovError ?? null,
      upserted: trialRes?.upserted ?? 0,
    },
  };
}

export { parseQuery } from "./parse-query";
export type { ParsedQuery, SearchResult } from "./types";
