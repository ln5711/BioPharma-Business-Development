import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { watchlists } from "@/db/schema";
import { parseQuery } from "@/lib/search/parse-query";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface WatchlistSpec {
  name: string;
  terms: string[];
  conditions: string[];
}

/**
 * The broad oncology universe every new workspace monitors so that HER2 / EGFR /
 * ALK / BRAF / MET / RET / ROS1 / FGFR / PIK3CA / BRCA / PSMA / KRAS and the
 * common oncology drug/trial terms are covered without hand-seeding each one.
 */
export const DEFAULT_ONCOLOGY_SPEC: WatchlistSpec = {
  name: "Oncology targets (starter)",
  terms: [
    "KRAS", "EGFR", "HER2", "ALK", "ROS1", "BRAF", "MET", "RET", "FGFR",
    "PIK3CA", "BRCA", "PSMA", "NTRK", "NRAS",
  ],
  conditions: [],
};

/**
 * Turn a user's onboarding priorities into concrete ClinicalTrials.gov watch
 * specs. Uses the same deterministic parser the search service uses, so a
 * priority like "KRAS G12C resistance" or "HER2 breast cancer" produces a
 * targeted watch. Priorities that carry no recognisable entity are ignored
 * here (the default oncology watch still covers them for live search).
 */
export function deriveWatchlistSpecs(priorityTexts: string[]): WatchlistSpec[] {
  const specs = new Map<string, WatchlistSpec>();
  for (const raw of priorityTexts) {
    const text = (raw ?? "").trim();
    if (!text) continue;
    const p = parseQuery(text);
    const terms = [...new Set([...p.biomarkers, ...p.assets, ...p.companies])].slice(0, 8);
    const conditions = p.indications.slice(0, 4);
    if (!terms.length && !conditions.length) continue;
    const name = (terms[0] ?? conditions[0] ?? text).slice(0, 55) + " (from priorities)";
    if (specs.has(name)) {
      const cur = specs.get(name)!;
      cur.terms = [...new Set([...cur.terms, ...terms])].slice(0, 8);
      cur.conditions = [...new Set([...cur.conditions, ...conditions])].slice(0, 4);
    } else {
      specs.set(name, { name, terms, conditions });
    }
  }
  return [...specs.values()].slice(0, 5);
}

/**
 * Create the starter watchlists for a brand-new tenant. Row creation only — no
 * network — so it is safe inside the signup path. The first ClinicalTrials.gov
 * pull is done afterwards (see `createAccount` → `after`) and by the daily cron.
 * Idempotent on (tenantId, name).
 */
export async function createStarterWatchlists(
  db: Db,
  tenantId: string,
  userId: string,
  priorityTexts: string[],
): Promise<{ id: string; name: string }[]> {
  const derived = deriveWatchlistSpecs(priorityTexts);
  const specs = [...derived, DEFAULT_ONCOLOGY_SPEC];

  const created: { id: string; name: string }[] = [];
  for (const spec of specs) {
    if (!spec.terms.length && !spec.conditions.length) continue;
    const [existing] = await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(and(eq(watchlists.tenantId, tenantId), eq(watchlists.name, spec.name)))
      .limit(1);
    if (existing) {
      created.push({ id: existing.id, name: spec.name });
      continue;
    }
    try {
      const [row] = await db
        .insert(watchlists)
        .values({
          tenantId,
          name: spec.name,
          description: "Created automatically at onboarding.",
          ownerUserId: userId,
          ctgovQuery: { terms: spec.terms, conditions: spec.conditions },
        })
        .returning({ id: watchlists.id });
      created.push({ id: row.id, name: spec.name });
    } catch {
      /* unique race — skip */
    }
  }
  return created;
}
