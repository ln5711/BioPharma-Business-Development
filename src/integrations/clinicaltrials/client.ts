import { env } from "@/lib/env";
import type { CtgovPage, CtgovQuery, CtgovStudy } from "./types";

const PAGE_SIZE = 100;

/**
 * ClinicalTrials.gov API v2 client (spec §6 / §58). Standard HTTP, polite
 * user-agent, exponential backoff, hard page cap. No key required.
 */
export class CtgovClient {
  constructor(
    private readonly baseUrl = env.CLINICALTRIALS_BASE_URL,
    private readonly userAgent = env.CLINICALTRIALS_USER_AGENT,
  ) {}

  private buildParams(query: CtgovQuery, pageToken?: string): URLSearchParams {
    const p = new URLSearchParams();
    if (query.nctId) p.set("query.id", query.nctId);
    if (query.terms.length) p.set("query.term", query.terms.join(" OR "));
    if (query.conditions?.length) p.set("query.cond", query.conditions.join(" OR "));
    if (query.statuses?.length) {
      p.set("filter.overallStatus", query.statuses.join("|"));
    }
    const filters: string[] = [...(query.advanced ?? [])];
    if (query.phases?.length) {
      filters.push(`AREA[Phase](${query.phases.join(" OR ")})`);
    }
    if (filters.length) p.set("filter.advanced", filters.join(" AND "));
    p.set("pageSize", String(PAGE_SIZE));
    p.set("countTotal", "true");
    if (pageToken) p.set("pageToken", pageToken);
    return p;
  }

  private async fetchPage(params: URLSearchParams): Promise<CtgovPage> {
    const url = `${this.baseUrl}/studies?${params.toString()}`;
    let attempt = 0;
    // 3 tries: 0s, 1s, 4s backoff.
    while (true) {
      try {
        const res = await fetch(url, {
          headers: { "user-agent": this.userAgent, accept: "application/json" },
        });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`ctgov ${res.status}`);
        }
        if (!res.ok) {
          throw new Error(`ctgov ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as CtgovPage;
      } catch (err) {
        attempt += 1;
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
      }
    }
  }

  /** Streams every study matching the query, up to `maxStudies`. */
  async *studies(query: CtgovQuery): AsyncGenerator<CtgovStudy> {
    const cap = query.maxStudies ?? 500;
    let pulled = 0;
    let pageToken: string | undefined;
    do {
      const page = await this.fetchPage(this.buildParams(query, pageToken));
      for (const study of page.studies ?? []) {
        yield study;
        pulled += 1;
        if (pulled >= cap) return;
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }

  async fetchOne(nctId: string): Promise<CtgovStudy | null> {
    const res = await fetch(`${this.baseUrl}/studies/${encodeURIComponent(nctId)}`, {
      headers: { "user-agent": this.userAgent, accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`ctgov ${res.status}: ${await res.text()}`);
    return (await res.json()) as CtgovStudy;
  }
}
