import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  discoveredContacts,
  people,
  personAssetEvidence,
  relationships,
  type EmailCandidate,
} from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

/** Normalize a profile URL for dedup comparison — protocol/www/trailing-slash/
 * query-string insensitive, so the same LinkedIn page never gets saved twice. */
export function normalizeProfileUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export interface SaveResult {
  personId: string;
  created: boolean;
  conflicts: string[];
}

/**
 * "Add to tracker" — persists a `discoveredContacts` row into `people` +
 * `relationships`. Deduplicates on stable identifiers (canonical profile URL,
 * or confirmed email within the same organization) — NEVER on name match
 * alone. Preserves any user-edited field the person has been marked
 * `manualOverrides` for, flagging a conflict instead of silently overwriting.
 */
export async function saveDiscoveredContact(
  params: { tenantId: string; userId: string; discoveredContactId: string },
): Promise<SaveResult> {
  const db = await getDb();
  const [dc] = await db
    .select()
    .from(discoveredContacts)
    .where(and(eq(discoveredContacts.id, params.discoveredContactId), eq(discoveredContacts.tenantId, params.tenantId)))
    .limit(1);
  if (!dc) throw new Error("Discovered contact not found for this workspace.");

  if (dc.savedPersonId) {
    await ensureRelationship(db, params.tenantId, params.userId, dc.savedPersonId);
    return { personId: dc.savedPersonId, created: false, conflicts: [] };
  }

  const existing = await findExistingPerson(db, params.tenantId, dc.organizationId, dc.professionalProfileUrl, dc.emailAddress);

  let personId: string;
  let created: boolean;
  let conflicts: string[] = [];

  if (existing) {
    personId = existing.id;
    created = false;
    conflicts = await mergeIntoExistingPerson(db, existing, dc);
  } else {
    const [row] = await db
      .insert(people)
      .values({
        tenantId: params.tenantId,
        organizationId: dc.organizationId,
        name: dc.name,
        title: dc.title,
        function: dc.function,
        seniority: dc.seniority,
        professionalProfileUrl: dc.professionalProfileUrl,
        headshotUrl: dc.headshotUrl,
        headshotSourceUrl: dc.headshotSourceUrl,
        description: dc.description,
        whyThisPerson: dc.whyThisPerson,
        whyNow: dc.whyNow,
        relatedAssetId: dc.relatedAssetId,
        relatedTrialId: dc.relatedTrialId,
        relatedSignalId: dc.relatedSignalId,
        useCase: dc.useCase,
        contactLabel: dc.contactLabel,
        relevanceScore: dc.relevanceScore,
        relevanceBreakdown: dc.relevanceBreakdown,
        sourceEvidence: dc.sourceEvidence,
        email: dc.emailAddress,
        emailProvenance: dc.emailProvenance,
        emailDeliverability: dc.emailDeliverability,
        emailPattern: dc.emailResult?.pattern ?? null,
        emailCandidates: dc.emailResult ? [dc.emailResult as EmailCandidate] : [],
        lastVerifiedAt: new Date(),
      })
      .returning({ id: people.id });
    personId = row.id;
    created = true;
  }

  await ensureRelationship(db, params.tenantId, params.userId, personId);
  await db.update(discoveredContacts).set({ savedPersonId: personId }).where(eq(discoveredContacts.id, dc.id));

  if (dc.contactLabel === "direct_program_evidence" && (dc.relatedAssetId || dc.relatedTrialId)) {
    const first = dc.sourceEvidence[0];
    await db
      .insert(personAssetEvidence)
      .values({
        personId,
        assetId: dc.relatedAssetId,
        trialId: dc.relatedTrialId,
        evidenceKind: "job_title",
        confidence: Math.min(100, dc.relevanceScore + 10),
        url: first?.url ?? null,
        excerpt: first?.excerpt ?? dc.whyThisPerson ?? null,
      })
      .catch(() => {}); // best-effort — never block a save on this
  }

  return { personId, created, conflicts };
}

async function findExistingPerson(
  db: Db,
  tenantId: string,
  organizationId: string | null,
  profileUrl: string | null,
  email: string | null,
) {
  const normTarget = normalizeProfileUrl(profileUrl);
  if (normTarget) {
    const candidates = await db
      .select({ id: people.id, professionalProfileUrl: people.professionalProfileUrl })
      .from(people)
      .where(and(eq(people.tenantId, tenantId), sql`${people.professionalProfileUrl} is not null`));
    const hit = candidates.find((c) => normalizeProfileUrl(c.professionalProfileUrl) === normTarget);
    if (hit) return { id: hit.id };
  }
  if (organizationId && email) {
    const [hit] = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.tenantId, tenantId),
          eq(people.organizationId, organizationId),
          sql`lower(${people.email}) = ${email.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (hit) return hit;
  }
  return null;
}

async function ensureRelationship(db: Db, tenantId: string, userId: string, personId: string) {
  const [existing] = await db
    .select({ id: relationships.id })
    .from(relationships)
    .where(and(eq(relationships.tenantId, tenantId), eq(relationships.personId, personId)))
    .limit(1);
  if (existing) return;
  await db
    .insert(relationships)
    .values({ tenantId, personId, ownerUserId: userId, outreachStatus: "new" })
    .onConflictDoNothing();
}

/** Applies research-derived fields onto an existing person, respecting
 * `manualOverrides`, and returns which fields were flagged as conflicting. */
async function mergeIntoExistingPerson(
  db: Db,
  existing: { id: string },
  dc: typeof discoveredContacts.$inferSelect,
): Promise<string[]> {
  const [person] = await db.select().from(people).where(eq(people.id, existing.id)).limit(1);
  if (!person) return [];

  const overrides = new Set(person.manualOverrides ?? []);
  const conflicts: string[] = [];
  const pendingConflicts = [...person.pendingConflicts];
  const set: Record<string, unknown> = { lastVerifiedAt: new Date() };

  const applyOrFlag = (field: "title" | "description", discoveredValue: string | null) => {
    if (discoveredValue == null) return;
    if (overrides.has(field)) {
      const current = (person as Record<string, unknown>)[field];
      if (current !== discoveredValue) {
        conflicts.push(field);
        pendingConflicts.push({ field, discoveredValue, discoveredAt: new Date().toISOString() });
      }
      return;
    }
    set[field] = discoveredValue;
  };
  applyOrFlag("title", dc.title);
  applyOrFlag("description", dc.description);

  // Non-user-editable research fields always refresh.
  set.function = dc.function;
  set.seniority = dc.seniority;
  set.whyThisPerson = dc.whyThisPerson;
  set.whyNow = dc.whyNow ?? person.whyNow;
  set.relevanceScore = dc.relevanceScore;
  set.relevanceBreakdown = dc.relevanceBreakdown;
  set.contactLabel = dc.contactLabel;
  set.sourceEvidence = dc.sourceEvidence;
  if (!person.professionalProfileUrl && dc.professionalProfileUrl) set.professionalProfileUrl = dc.professionalProfileUrl;
  if (!person.headshotUrl && dc.headshotUrl) {
    set.headshotUrl = dc.headshotUrl;
    set.headshotSourceUrl = dc.headshotSourceUrl;
  }
  if (!person.relatedAssetId && dc.relatedAssetId) set.relatedAssetId = dc.relatedAssetId;
  if (!person.relatedTrialId && dc.relatedTrialId) set.relatedTrialId = dc.relatedTrialId;
  if (!person.relatedSignalId && dc.relatedSignalId) set.relatedSignalId = dc.relatedSignalId;
  if (!person.useCase && dc.useCase) set.useCase = dc.useCase;

  // Email: a user-supplied address is never silently replaced; every
  // discovery attempt is retained in history either way.
  if (dc.emailResult) {
    const history = [...person.emailCandidates, dc.emailResult as EmailCandidate];
    set.emailCandidates = history;
    if (person.emailProvenance === "user_supplied") {
      if (dc.emailAddress && dc.emailAddress !== person.email) {
        conflicts.push("email");
        pendingConflicts.push({ field: "email", discoveredValue: dc.emailAddress, discoveredAt: new Date().toISOString() });
      }
    } else if (dc.emailAddress) {
      set.email = dc.emailAddress;
      set.emailProvenance = dc.emailProvenance;
      set.emailDeliverability = dc.emailDeliverability;
      set.emailPattern = dc.emailResult.pattern;
    }
  }

  if (pendingConflicts.length !== person.pendingConflicts.length) set.pendingConflicts = pendingConflicts;

  await db.update(people).set(set).where(eq(people.id, existing.id));
  return conflicts;
}
