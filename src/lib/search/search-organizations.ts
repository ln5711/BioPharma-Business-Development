import "server-only";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { organizationAliases, organizations } from "@/db/schema";
import type { CompanySearchResult, ParsedQuery } from "./types";

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** Tenant-scoped company/sponsor search over name, domain, ticker and aliases. */
export async function searchOrganizationsService(
  tenantId: string,
  p: ParsedQuery,
  limit = 6,
): Promise<CompanySearchResult[]> {
  const names = [...new Set([...p.companies].map((c) => c.trim()).filter((c) => c.length >= 2))];
  if (!names.length) return [];
  const db = await getDb();

  // Aliases have no tenant column; the org query below is tenant-scoped, so an
  // alias belonging to another tenant's org simply won't match there.
  const aliasRows = await db
    .select({ orgId: organizationAliases.organizationId })
    .from(organizationAliases)
    .where(or(...names.map((n) => ilike(organizationAliases.alias, likeArg(n)))))
    .limit(20);
  const aliasIds = [...new Set(aliasRows.map((r) => r.orgId).filter(Boolean))] as string[];

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.canonicalName,
      type: organizations.organizationType,
      ticker: organizations.ticker,
      domain: organizations.canonicalDomain,
    })
    .from(organizations)
    .where(
      and(
        eq(organizations.tenantId, tenantId),
        or(
          ...names.flatMap((n) => [
            ilike(organizations.canonicalName, likeArg(n)),
            ilike(organizations.canonicalDomain, likeArg(n)),
            ilike(organizations.ticker, n),
          ]),
          ...(aliasIds.length ? [inArray(organizations.id, aliasIds)] : []),
        ),
      ),
    )
    .limit(limit * 2);

  const scored = rows.map((r) => {
    let s = 0;
    const nl = r.name.toLowerCase();
    for (const n of names) {
      const q = n.toLowerCase();
      if (nl === q) s += 40;
      else if (nl.startsWith(q)) s += 20;
      else if (nl.includes(q)) s += 10;
    }
    if (aliasIds.includes(r.id)) s += 15;
    if (r.ticker) s += 2;
    return {
      kind: "company" as const,
      id: r.id,
      name: r.name,
      type: r.type ? String(r.type).replace(/_/g, " ") : null,
      ticker: r.ticker ?? null,
      recordUrl: `/accounts/${r.id}`,
      score: s,
    };
  });

  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .slice(0, limit);
}
