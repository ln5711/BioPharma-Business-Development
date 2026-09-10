import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { researchCache } from "@/db/schema";
import type { PublicTrial } from "./public-research";

/**
 * Short-lived cache of the PUBLIC half of an Ask newwin research answer — the
 * web briefing, its citations, the ClinicalTrials.gov hits and the follow-up
 * suggestions. Never stores workspace data, so it is safe to share across
 * tenants. Workspace records are always retrieved fresh per request.
 */
export interface CachedResearch {
  answer: string;
  synthesis: "ok" | "failed" | "skipped" | "no_model";
  webText: string;
  externalCitations: { url: string; title: string }[];
  ctgovTrials: PublicTrial[];
  suggestions: string[];
  researchRequestId: string | null;
  model: string | null;
}

const TTL_MS = 30 * 60_000;

/** Stable cache key from the parts of the query that determine a public answer. */
export function researchCacheKey(parts: {
  query: string;
  companies: string[];
  topics: string[];
  biomarkers: string[];
  indications: string[];
  assets: string[];
  personRoles: string[];
  statuses: string[];
  wantsExternalResearch: boolean;
}): string {
  const norm = (a: string[]) => [...new Set(a.map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  const shape = JSON.stringify({
    q: parts.query.trim().toLowerCase().replace(/\s+/g, " "),
    c: norm(parts.companies),
    t: norm(parts.topics),
    b: norm(parts.biomarkers),
    i: norm(parts.indications),
    a: norm(parts.assets),
    r: norm(parts.personRoles),
    s: norm(parts.statuses),
    x: parts.wantsExternalResearch,
  });
  return "rc_" + createHash("sha256").update(shape).digest("hex").slice(0, 40);
}

export async function getCachedResearch(key: string): Promise<CachedResearch | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ payload: researchCache.payload, createdAt: researchCache.createdAt })
      .from(researchCache)
      .where(eq(researchCache.key, key))
      .limit(1);
    if (!row) return null;
    const age = Date.now() - new Date(row.createdAt as unknown as string).getTime();
    if (age > TTL_MS) return null;
    return row.payload as unknown as CachedResearch;
  } catch {
    return null; // cache is best-effort; never fail a search on it
  }
}

export async function putCachedResearch(key: string, value: CachedResearch): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(researchCache)
      .values({ key, payload: value as unknown as Record<string, unknown>, createdAt: new Date() })
      .onConflictDoUpdate({
        target: researchCache.key,
        set: { payload: value as unknown as Record<string, unknown>, createdAt: new Date() },
      });
    // Opportunistic GC of expired rows.
    await db.delete(researchCache).where(lt(researchCache.createdAt, new Date(Date.now() - TTL_MS)));
  } catch {
    /* best-effort */
  }
}
