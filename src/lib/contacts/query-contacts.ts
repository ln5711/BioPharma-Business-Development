import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assets,
  commercialSignals,
  interactions,
  organizations,
  people,
  relationships,
  trials,
  users,
} from "@/db/schema";
import { splitName } from "./name";
import type { ContactViewModel } from "./view-model";

export interface SavedContactFilters {
  q?: string; // free-text: name/title/company
  organizationId?: string;
  function?: string;
  seniority?: string;
  emailAvailability?: "any" | "has_email" | "no_email";
  outreachStatus?: string;
  favoriteOnly?: boolean;
  view?: "all" | "favorites" | "followups";
  limit?: number;
}

export interface SavedContactRow {
  person: typeof people.$inferSelect;
  relationship: typeof relationships.$inferSelect | null;
  organizationName: string | null;
  ownerName: string | null;
  assetName: string | null;
  trialNctId: string | null;
  signalHeadline: string | null;
  outreachCount: number;
  latestOutcome: string | null;
}

const likeArg = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/**
 * The SINGLE query behind Saved / Favorites / Follow-ups and both the card
 * grid and the table view — and the export route — so every surface reflects
 * the same persisted state. Tenant-scoped; never returns another tenant's rows.
 */
export async function getSavedContacts(tenantId: string, filters: SavedContactFilters = {}): Promise<SavedContactRow[]> {
  const db = await getDb();

  const conds = [eq(people.tenantId, tenantId), isNotNull(relationships.id)];
  if (filters.organizationId) conds.push(eq(people.organizationId, filters.organizationId));
  if (filters.function) conds.push(eq(people.function, filters.function as never));
  if (filters.seniority) conds.push(eq(people.seniority, filters.seniority as never));
  if (filters.emailAvailability === "has_email") conds.push(isNotNull(people.email));
  if (filters.emailAvailability === "no_email") conds.push(isNull(people.email));
  if (filters.outreachStatus) conds.push(eq(relationships.outreachStatus, filters.outreachStatus as never));
  if (filters.favoriteOnly || filters.view === "favorites") conds.push(eq(relationships.favorite, true));
  if (filters.view === "followups") {
    conds.push(
      or(eq(relationships.outreachStatus, "follow_up_due"), sql`${relationships.nextFollowUpAt} is not null`)!,
    );
  }
  if (filters.q) {
    const a = likeArg(filters.q);
    conds.push(or(ilike(people.name, a), ilike(people.title, a), ilike(organizations.canonicalName, a))!);
  }

  const rows = await db
    .select({
      person: people,
      relationship: relationships,
      organizationName: organizations.canonicalName,
      ownerName: users.name,
      assetName: assets.canonicalName,
      trialNctId: trials.nctId,
      signalHeadline: commercialSignals.headline,
    })
    .from(people)
    .innerJoin(relationships, eq(relationships.personId, people.id))
    .leftJoin(organizations, eq(organizations.id, people.organizationId))
    .leftJoin(users, eq(users.id, relationships.ownerUserId))
    .leftJoin(assets, eq(assets.id, people.relatedAssetId))
    .leftJoin(trials, eq(trials.id, people.relatedTrialId))
    .leftJoin(commercialSignals, eq(commercialSignals.id, people.relatedSignalId))
    .where(and(...conds))
    .orderBy(desc(relationships.favorite), desc(relationships.updatedAt))
    .limit(filters.limit ?? 500);

  if (rows.length === 0) return [];

  const personIds = rows.map((r) => r.person.id);
  const activity = await db
    .select({
      personId: interactions.personId,
      n: sql<number>`count(*)::int`,
      latestOutcome: sql<string | null>`(array_agg(${interactions.outcome} order by ${interactions.occurredAt} desc))[1]`,
    })
    .from(interactions)
    .where(and(eq(interactions.tenantId, tenantId), inArray(interactions.personId, personIds)))
    .groupBy(interactions.personId);
  const activityByPerson = new Map(activity.map((a) => [a.personId, a]));

  return rows.map((r) => ({
    ...r,
    outreachCount: activityByPerson.get(r.person.id)?.n ?? 0,
    latestOutcome: activityByPerson.get(r.person.id)?.latestOutcome ?? null,
  }));
}

export interface ActivityRow {
  personName: string;
  organizationName: string | null;
  type: string;
  occurredAt: Date;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  nextStep: string | null;
}

export async function getActivityRows(tenantId: string, personIds?: string[]): Promise<ActivityRow[]> {
  const db = await getDb();
  const conds = [eq(interactions.tenantId, tenantId)];
  if (personIds?.length) conds.push(inArray(interactions.personId, personIds));
  const rows = await db
    .select({
      personName: people.name,
      organizationName: organizations.canonicalName,
      type: interactions.type,
      occurredAt: interactions.occurredAt,
      subject: interactions.subject,
      body: interactions.body,
      outcome: interactions.outcome,
      nextStep: interactions.nextStep,
    })
    .from(interactions)
    .leftJoin(people, eq(people.id, interactions.personId))
    .leftJoin(organizations, eq(organizations.id, interactions.organizationId))
    .where(and(...conds))
    .orderBy(desc(interactions.occurredAt))
    .limit(5000);
  return rows.map((r) => ({ ...r, personName: r.personName ?? "(unknown contact)" }));
}

/** Split a stored full name into editable First/Last — blank rather than a
 * guessed split when the name isn't confidently splittable. */
export function editableNameParts(fullName: string): { first: string; last: string } {
  const s = splitName(fullName);
  if (s.ambiguous) return { first: "", last: "" };
  return { first: s.first, last: s.last };
}

const LINKEDIN_RE = /linkedin\.com/i;

export function classifyProfileUrl(url: string | null): { linkedin: string | null; companyProfile: string | null } {
  if (!url) return { linkedin: null, companyProfile: null };
  return LINKEDIN_RE.test(url) ? { linkedin: url, companyProfile: null } : { linkedin: null, companyProfile: url };
}

export function savedContactToViewModel(row: SavedContactRow): ContactViewModel {
  const p = row.person;
  const rel = row.relationship;
  const lastCandidate = p.emailCandidates[p.emailCandidates.length - 1] ?? null;
  return {
    id: p.id,
    personId: p.id,
    discoveredContactId: null,
    saved: true,
    name: p.name,
    title: p.title,
    company: row.organizationName,
    organizationId: p.organizationId,
    function: p.function,
    seniority: p.seniority,
    professionalProfileUrl: p.professionalProfileUrl,
    headshotUrl: p.headshotUrl,
    headshotSourceUrl: p.headshotSourceUrl,
    description: p.description,
    whyThisPerson: p.whyThisPerson,
    whyNow: p.whyNow,
    useCase: p.useCase,
    assetLabel: row.assetName,
    trialNctId: row.trialNctId,
    signalHeadline: row.signalHeadline,
    contactLabel: p.contactLabel,
    relevanceScore: p.relevanceScore,
    relevanceBreakdown: p.relevanceBreakdown,
    email: p.email,
    emailProvenance: p.emailProvenance,
    emailDeliverability: p.emailDeliverability,
    emailPattern: p.emailPattern,
    emailEvidenceCount: lastCandidate?.sources.length ?? 0,
    emailSupportingCount: lastCandidate?.supportingExamples.length ?? 0,
    emailNote: lastCandidate?.note ?? null,
    sourceEvidence: p.sourceEvidence,
    lastResearchedAt: p.lastVerifiedAt ? p.lastVerifiedAt.toISOString() : null,
    favorite: rel?.favorite ?? false,
    outreachStatus: rel?.outreachStatus ?? "new",
    lastContactedAt: rel?.lastContactedAt ? rel.lastContactedAt.toISOString() : null,
    lastResponseAt: rel?.lastResponseAt ? rel.lastResponseAt.toISOString() : null,
    nextFollowUpAt: rel?.nextFollowUpAt ? rel.nextFollowUpAt.toISOString() : null,
    notes: rel?.notes ?? null,
    ownerName: row.ownerName,
    outreachCount: row.outreachCount,
    pendingConflicts: p.pendingConflicts,
  };
}

export function currentEmailEvidenceUrls(row: SavedContactRow["person"]): string[] {
  const last = row.emailCandidates[row.emailCandidates.length - 1];
  if (!last) return [];
  return [...last.sources.map((s) => s.url).filter((u): u is string => !!u), ...last.supportingExamples.map((e) => e.sourceUrl)];
}
