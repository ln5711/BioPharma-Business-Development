import "server-only";
import { CtgovClient } from "@/integrations/clinicaltrials/client";
import { normalizeStudy } from "@/integrations/clinicaltrials/normalize";

/**
 * PUBLIC research retrieval — the ClinicalTrials.gov API (structured trial
 * discovery). No workspace data, no credentials. Bounded and time-limited.
 */

export interface PublicTrial {
  nctId: string;
  title: string;
  phase: string;
  status: string;
  sponsor: string | null;
  conditions: string[];
  interventions: string[];
  firstPostedDate: string | null;
  lastUpdateDate: string | null;
  url: string;
}

const PHASE_LABEL: Record<string, string> = {
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

export interface CtgovSearchParams {
  terms?: string[];
  conditions?: string[];
  statuses?: string[]; // CT.gov overall-status values
  limit?: number;
  signal?: AbortSignal;
}

/** Live ClinicalTrials.gov search. Returns lightweight trial summaries. */
export async function ctgovSearch(p: CtgovSearchParams): Promise<PublicTrial[]> {
  const terms = (p.terms ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const conditions = (p.conditions ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 6);
  if (!terms.length && !conditions.length) return [];

  const limit = Math.min(20, Math.max(1, p.limit ?? 12));
  const client = new CtgovClient();
  const out: PublicTrial[] = [];

  const iter = client.studies({
    terms,
    conditions,
    statuses: p.statuses?.length
      ? p.statuses
      : ["RECRUITING", "ACTIVE_NOT_RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"],
    maxStudies: limit,
  });

  // Hard wall so a slow upstream can't stall the request.
  const deadline = Date.now() + 12_000;
  try {
    for await (const study of iter) {
      if (Date.now() > deadline || p.signal?.aborted) break;
      let n;
      try {
        n = normalizeStudy(study);
      } catch {
        continue;
      }
      out.push({
        nctId: n.nctId,
        title: n.title ?? n.nctId,
        phase: PHASE_LABEL[n.phase] ?? n.phase,
        status: n.status.replace(/_/g, " "),
        sponsor: n.sponsorName ?? null,
        conditions: (n.conditionsRaw ?? []).slice(0, 4),
        interventions: (n.interventionsRaw ?? []).map((i) => i.name).filter(Boolean).slice(0, 4),
        firstPostedDate: n.firstPostedDate ? n.firstPostedDate.toISOString().slice(0, 10) : null,
        lastUpdateDate: n.lastCtgovUpdate ? n.lastCtgovUpdate.toISOString().slice(0, 10) : null,
        url: `https://clinicaltrials.gov/study/${n.nctId}`,
      });
      if (out.length >= limit) break;
    }
  } catch {
    // upstream error → return whatever we have; the pipeline reports the state
  }
  return out;
}
