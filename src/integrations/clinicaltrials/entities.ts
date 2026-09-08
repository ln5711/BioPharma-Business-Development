import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  organizationAliases,
  organizations,
} from "@/db/schema";
import { normalizeName } from "@/lib/oncology/normalize-terms";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Resolve a sponsor / collaborator name to an Organization for a tenant
 * (spec §54 — alias-aware, never duplicate on terminology). Creates a
 * lightly-populated org row when nothing matches so trials always link
 * somewhere; enrichment happens later via the company-web adapter (MVP 2).
 */
export async function resolveOrganization(
  db: Db,
  tenantId: string,
  rawName: string,
): Promise<string | null> {
  const name = rawName.trim();
  if (!name) return null;
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const aliasHit = await db
    .select({ organizationId: organizationAliases.organizationId })
    .from(organizationAliases)
    .innerJoin(organizations, eq(organizations.id, organizationAliases.organizationId))
    .where(
      and(
        eq(organizations.tenantId, tenantId),
        eq(organizationAliases.normalized, normalized),
      ),
    )
    .limit(1);
  if (aliasHit[0]) return aliasHit[0].organizationId;

  const nameHit = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.tenantId, tenantId), eq(organizations.canonicalName, name)))
    .limit(1);
  if (nameHit[0]) return nameHit[0].id;

  const [created] = await db
    .insert(organizations)
    .values({
      tenantId,
      canonicalName: name,
      organizationType: guessOrgType(name),
      accountTier: "watch",
      oncologyFocus: true,
    })
    .returning({ id: organizations.id });

  await db
    .insert(organizationAliases)
    .values({ organizationId: created.id, alias: name, normalized, kind: "name" })
    .onConflictDoNothing();

  return created.id;
}

function guessOrgType(name: string): "pharma" | "biotech" | "academic" | "cro" | "other" {
  const n = name.toLowerCase();
  if (/(university|hospital|institut|cancer center|college|nhs|foundation|national)/.test(n))
    return "academic";
  if (/(cro|contract research|iqvia|parexel|icon plc|syneos)/.test(n)) return "cro";
  if (
    /(pfizer|novartis|roche|astrazeneca|merck|bristol|gsk|glaxo|sanofi|amgen|gilead|abbvie|johnson|takeda|bayer|eli lilly|lilly|boehringer)/.test(
      n,
    )
  )
    return "pharma";
  return "biotech";
}
