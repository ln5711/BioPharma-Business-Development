import "server-only";
import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { commercialSignals, organizations, signalSources } from "@/db/schema";
import { LANDSCAPE_ONLY_SIGNALS } from "@/lib/signals/taxonomy";

export interface TopSignalForOutreach {
  id: string;
  headline: string;
  whyNow: string | null;
  sourceDate: string | null;
  opportunityScore: number | null;
  organizationId: string | null;
  organizationName: string | null;
  sourceUrl: string | null;
}

/** High-priority company signals for the Discover view — reuses the same
 * opportunity scoring and exclusions as the rest of the app (never a raw
 * unscored feed, never a landscape-only "added to monitoring" bookkeeping row). */
export async function getTopSignalsForOutreach(tenantId: string, limit = 8): Promise<TopSignalForOutreach[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: commercialSignals.id,
      headline: commercialSignals.headline,
      whyNow: commercialSignals.whyNow,
      sourceDate: commercialSignals.sourceDate,
      opportunityScore: commercialSignals.opportunityScore,
      organizationId: commercialSignals.organizationId,
      organizationName: organizations.canonicalName,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        notInArray(commercialSignals.signalType, [...LANDSCAPE_ONLY_SIGNALS] as never[]),
      ),
    )
    .orderBy(desc(commercialSignals.opportunityScore), desc(commercialSignals.sourceDate))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const sources = ids.length
    ? await db.select().from(signalSources).where(inArray(signalSources.signalId, ids)).orderBy(desc(signalSources.publishedAt))
    : [];
  const urlBySignal = new Map<string, string | null>();
  for (const s of sources) if (!urlBySignal.has(s.signalId)) urlBySignal.set(s.signalId, s.url);

  return rows.map((r) => ({
    ...r,
    sourceDate: r.sourceDate ? new Date(r.sourceDate).toISOString().slice(0, 10) : null,
    sourceUrl: urlBySignal.get(r.id) ?? null,
  }));
}
