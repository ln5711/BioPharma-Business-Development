import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, people } from "@/db/schema";
import type { ParsedQuery, PersonSearchResult } from "./types";

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** Tenant-scoped people search over name, title, function and organisation. */
export async function searchPeopleService(
  tenantId: string,
  p: ParsedQuery,
  limit = 6,
): Promise<PersonSearchResult[]> {
  const needles = [
    ...p.companies.map((c) => c.toLowerCase()),
    ...p.personRoles.map((r) => r.toLowerCase()),
    ...p.terms,
  ];
  const uniq = [...new Set(needles.map((n) => n.trim()).filter((n) => n.length >= 2))];
  if (!uniq.length) return [];
  const db = await getDb();

  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      fn: people.function,
      relevance: people.relevanceScore,
      org: organizations.canonicalName,
      orgId: people.organizationId,
    })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.organizationId))
    .where(
      and(
        eq(people.tenantId, tenantId),
        or(
          ...uniq.flatMap((n) => [
            ilike(people.name, likeArg(n)),
            ilike(people.title, likeArg(n)),
            ilike(people.department, likeArg(n)),
            ilike(organizations.canonicalName, likeArg(n)),
          ]),
        ),
      ),
    )
    .orderBy(desc(people.relevanceScore))
    .limit(limit * 2);

  const scored = rows.map((r) => {
    let s = r.relevance ? r.relevance / 20 : 0;
    const hay = `${r.name} ${r.title ?? ""} ${r.org ?? ""}`.toLowerCase();
    for (const c of p.companies) if ((r.org ?? "").toLowerCase().includes(c.toLowerCase())) s += 20;
    for (const role of p.personRoles) if (hay.includes(role.toLowerCase())) s += 12;
    for (const t of p.terms) if (hay.includes(t)) s += 2;
    return {
      kind: "person" as const,
      id: r.id,
      name: r.name,
      title: r.title ?? null,
      role: r.fn ? String(r.fn).replace(/_/g, " ") : null,
      company: r.org ?? null,
      recordUrl: r.orgId ? `/accounts/${r.orgId}` : "/people",
      score: s,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
