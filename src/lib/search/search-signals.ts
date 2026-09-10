import "server-only";
import { and, desc, eq, ilike, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { commercialSignals, organizations, trials } from "@/db/schema";
import { LANDSCAPE_ONLY_SIGNALS } from "@/lib/signals/taxonomy";
import type { ParsedQuery, SignalSearchResult } from "./types";

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

/** Tenant-scoped, tokenised search over commercial signals / news / changes. */
export async function searchSignalsService(
  tenantId: string,
  p: ParsedQuery,
  limit = 8,
): Promise<SignalSearchResult[]> {
  const db = await getDb();
  const needles = [
    ...p.phrases,
    ...p.biomarkers.map((b) => b.toLowerCase()),
    ...p.assets.map((a) => a.toLowerCase()),
    ...p.companies.map((c) => c.toLowerCase()),
    ...p.indications,
    ...p.terms,
  ];
  const uniq = [...new Set(needles.map((n) => n.trim()).filter((n) => n.length >= 2))];
  if (!uniq.length) return [];

  const matchers = uniq.flatMap((n) => {
    const a = likeArg(n);
    return [
      ilike(commercialSignals.headline, a),
      ilike(commercialSignals.factSummary, a),
      ilike(commercialSignals.whyNow, a),
      ilike(commercialSignals.whyItMatters, a),
      ilike(organizations.canonicalName, a),
      ilike(trials.nctId, a),
      ilike(trials.title, a),
    ];
  });

  const conds = [
    eq(commercialSignals.tenantId, tenantId),
    notInArray(commercialSignals.signalType, [...LANDSCAPE_ONLY_SIGNALS] as never[]),
    or(...matchers)!,
  ];
  if (p.freshness.days != null) {
    const since = new Date(Date.now() - p.freshness.days * 86_400_000).toISOString();
    conds.push(
      sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt}) >= ${since}::timestamptz`,
    );
  }

  const rows = await db
    .select({
      id: commercialSignals.id,
      headline: commercialSignals.headline,
      factSummary: commercialSignals.factSummary,
      signalType: commercialSignals.signalType,
      opportunityScore: commercialSignals.opportunityScore,
      sourceDate: commercialSignals.sourceDate,
      detectedAt: commercialSignals.detectedAt,
      org: organizations.canonicalName,
      nct: trials.nctId,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(and(...conds))
    .orderBy(desc(sql`coalesce(${commercialSignals.sourceDate}, ${commercialSignals.detectedAt})`))
    .limit(limit * 2);

  const lower = (s: string | null) => (s ?? "").toLowerCase();
  const scored = rows.map((r) => {
    let s = r.opportunityScore ? r.opportunityScore / 20 : 0;
    const hay = `${lower(r.headline)} ${lower(r.factSummary)} ${lower(r.org)} ${lower(r.nct)}`;
    for (const b of p.biomarkers) if (hay.includes(b.toLowerCase())) s += 10;
    for (const a of p.assets) if (hay.includes(a.toLowerCase())) s += 12;
    for (const c of p.companies) if (hay.includes(c.toLowerCase())) s += 12;
    for (const t of p.terms) if (hay.includes(t)) s += 2;
    const d = r.sourceDate ?? r.detectedAt;
    if (d) {
      const age = (Date.now() - new Date(d).getTime()) / 86_400_000;
      if (age < 7) s += 8;
      else if (age < 30) s += 4;
    }
    return {
      kind: "signal" as const,
      id: r.id,
      headline: r.headline,
      summary: r.factSummary,
      signalType: String(r.signalType).replace(/_/g, " ").toLowerCase(),
      company: r.org,
      nctId: r.nct,
      eventDate: iso(r.sourceDate ?? r.detectedAt),
      recordUrl: r.nct ? `/trials/${r.nct}` : `/intelligence?signal=${r.id}`,
      sourceUrl: null,
      score: s,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
