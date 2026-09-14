"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { outreachDrafts, people, relationships } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { saveDiscoveredContact } from "@/lib/contacts/save";
import { generateOutreachDraft, logOutreachActivity, type Channel } from "@/lib/contacts/outreach-log";
import { isPlausibleEmail } from "@/lib/contacts/email";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function revalidateAll(organizationId?: string | null) {
  revalidatePath("/outreach");
  revalidatePath("/");
  if (organizationId) revalidatePath(`/accounts/${organizationId}`);
}

/** "Add to tracker" — persists a discovered candidate as a real contact. */
export async function addToTracker(discoveredContactId: string): Promise<ActionResult> {
  const { tenant, user } = await getActiveTenant();
  try {
    const res = await saveDiscoveredContact({ tenantId: tenant.id, userId: user.id, discoveredContactId });
    revalidateAll();
    return { ok: true, message: res.created ? "Added to your tracker." : "Matched an existing saved contact — details refreshed." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleFavorite(personId: string): Promise<ActionResult> {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select({ id: people.id }).from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };

  const [rel] = await db.select().from(relationships).where(and(eq(relationships.tenantId, tenant.id), eq(relationships.personId, personId))).limit(1);
  if (!rel) {
    await db.insert(relationships).values({ tenantId: tenant.id, personId, ownerUserId: user.id, favorite: true, outreachStatus: "new" });
  } else {
    await db.update(relationships).set({ favorite: !rel.favorite, updatedAt: new Date() }).where(eq(relationships.id, rel.id));
  }
  revalidateAll();
  return { ok: true };
}

const OUTREACH_STATUSES = new Set([
  "new", "researching", "ready_to_contact", "contacted", "follow_up_due",
  "replied", "meeting_scheduled", "qualified_opportunity", "not_interested", "do_not_contact",
]);

export async function updateOutreachStatus(personId: string, status: string): Promise<ActionResult> {
  if (!OUTREACH_STATUSES.has(status)) return { ok: false, error: "Unknown status." };
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select({ id: people.id }).from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };

  const [rel] = await db.select({ id: relationships.id }).from(relationships).where(and(eq(relationships.tenantId, tenant.id), eq(relationships.personId, personId))).limit(1);
  if (rel) {
    await db.update(relationships).set({ outreachStatus: status as never, updatedAt: new Date() }).where(eq(relationships.id, rel.id));
  } else {
    await db.insert(relationships).values({ tenantId: tenant.id, personId, ownerUserId: user.id, outreachStatus: status as never });
  }
  revalidateAll();
  return { ok: true };
}

/** Manual email correction — retains prior provenance in history, never loses it. */
export async function updateContactEmail(personId: string, address: string): Promise<ActionResult> {
  const clean = address.trim().toLowerCase();
  if (clean && !isPlausibleEmail(clean)) return { ok: false, error: "That doesn't look like a valid email address." };
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select().from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };

  const history = [
    ...person.emailCandidates,
    {
      address: clean || null,
      provenance: "user_supplied" as const,
      pattern: null,
      domain: clean.split("@")[1] ?? null,
      supportingExamples: [],
      sources: [],
      confidence: "high" as const,
      note: "Manually corrected by a user.",
      resolvedAt: new Date().toISOString(),
    },
  ];
  await db
    .update(people)
    .set({
      email: clean || null,
      emailProvenance: "user_supplied",
      emailDeliverability: "not_checked",
      emailPattern: null,
      emailCandidates: history,
      manualOverrides: [...new Set([...person.manualOverrides, "email"])],
    })
    .where(eq(people.id, personId));
  revalidateAll();
  return { ok: true, message: "Email updated." };
}

/** Manual edit of title/description — locks the field against silent
 * overwrite on the next research refresh (see save.ts). */
export async function updateContactField(personId: string, field: "title" | "description", value: string): Promise<ActionResult> {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select({ id: people.id, manualOverrides: people.manualOverrides }).from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };
  await db
    .update(people)
    .set({ [field]: value.trim().slice(0, 600), manualOverrides: [...new Set([...person.manualOverrides, field])] })
    .where(eq(people.id, personId));
  revalidateAll();
  return { ok: true };
}

/** Accept the freshly-discovered value, or keep the current one — either way
 * clears the pending conflict. */
export async function resolveConflict(personId: string, field: string, keep: "discovered" | "current"): Promise<ActionResult> {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select().from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };

  const conflict = person.pendingConflicts.find((c) => c.field === field);
  const remaining = person.pendingConflicts.filter((c) => c.field !== field);
  const set: Record<string, unknown> = { pendingConflicts: remaining };
  if (keep === "discovered" && conflict) {
    if (field === "email") {
      set.email = conflict.discoveredValue;
      set.emailProvenance = "publicly_sourced";
      set.manualOverrides = person.manualOverrides.filter((f) => f !== "email");
    } else {
      set[field] = conflict.discoveredValue;
      set.manualOverrides = person.manualOverrides.filter((f) => f !== field);
    }
  }
  await db.update(people).set(set).where(eq(people.id, personId));
  revalidateAll();
  return { ok: true };
}

/** Generates (or regenerates) an editable draft, grounded in evidence + the
 * tenant's own configured capabilities. Saved as a draft — never sent. */
export async function createDraft(personId: string): Promise<{ ok: true; draftId: string } | { ok: false; error: string }> {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const [person] = await db.select().from(people).where(and(eq(people.id, personId), eq(people.tenantId, tenant.id))).limit(1);
  if (!person) return { ok: false, error: "Contact not found." };

  const draft = await generateOutreachDraft({ tenantId: tenant.id, userId: user.id, personId });
  const evidenceRefs = person.sourceEvidence.slice(0, 5).map((e, i) => ({
    kind: e.kind, id: String(i), label: e.excerpt?.slice(0, 80) ?? e.kind, url: e.url ?? "",
  }));

  const [row] = await db
    .insert(outreachDrafts)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      personId,
      organizationId: person.organizationId,
      recipientName: person.name,
      recipientEmail: person.email,
      subject: draft.subject,
      body: draft.body,
      evidenceRefs,
      generatedBy: draft.generatedBy,
    })
    .returning({ id: outreachDrafts.id });

  revalidateAll();
  return { ok: true, draftId: row.id };
}

export async function updateDraft(draftId: string, subject: string, body: string): Promise<ActionResult> {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const [d] = await db.select({ id: outreachDrafts.id }).from(outreachDrafts).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.tenantId, tenant.id))).limit(1);
  if (!d) return { ok: false, error: "Draft not found." };
  await db.update(outreachDrafts).set({ subject, body, generatedBy: "user", updatedAt: new Date() }).where(eq(outreachDrafts.id, draftId));
  revalidateAll();
  return { ok: true };
}

export async function archiveDraft(draftId: string): Promise<ActionResult> {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  await db.update(outreachDrafts).set({ status: "archived", updatedAt: new Date() }).where(and(eq(outreachDrafts.id, draftId), eq(outreachDrafts.tenantId, tenant.id)));
  revalidateAll();
  return { ok: true };
}

export interface HistoryItem {
  id: string;
  type: string;
  occurredAt: string;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  nextStep: string | null;
}

/** Read-only: the last 20 logged interactions for ONE contact, tenant-scoped.
 * Logging for one person must never surface or touch another's history. */
export async function getContactHistory(personId: string): Promise<HistoryItem[]> {
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  const { interactions } = await import("@/db/schema");
  const { desc } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(interactions)
    .where(and(eq(interactions.tenantId, tenant.id), eq(interactions.personId, personId)))
    .orderBy(desc(interactions.occurredAt))
    .limit(20);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    occurredAt: r.occurredAt.toISOString(),
    subject: r.subject,
    body: r.body,
    outcome: r.outcome,
    nextStep: r.nextStep,
  }));
}

const CHANNELS = new Set<Channel>(["email", "linkedin", "call", "meeting", "conference", "note"]);

/**
 * Log outreach — FIXED (spec §6): requires a validated personId, writes the
 * correct interaction type, touches only that person's relationship, never
 * advances lastContactedAt for a note, respects Do Not Contact, is
 * resubmission-safe, and creates/updates a real follow-up task.
 */
export async function logOutreach(formData: FormData): Promise<ActionResult> {
  const personId = String(formData.get("personId") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "email");
  if (!personId) return { ok: false, error: "Select a contact to log outreach for." };
  if (!CHANNELS.has(channelRaw as Channel)) return { ok: false, error: "Unknown channel." };

  const { tenant, user } = await getActiveTenant();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 300) || null;
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000) || null;
  const outcome = String(formData.get("outcome") ?? "").trim().slice(0, 200) || null;
  const nextStep = String(formData.get("nextStep") ?? "").trim().slice(0, 300) || null;
  const followUpDate = String(formData.get("followUpDate") ?? "").trim() || null;
  const direction = (String(formData.get("direction") ?? "") || null) as "outbound" | "inbound" | null;

  try {
    const res = await logOutreachActivity({
      tenantId: tenant.id,
      userId: user.id,
      personId,
      channel: channelRaw as Channel,
      subject,
      body,
      outcome,
      nextStep,
      followUpDate,
      direction,
    });
    if (res.blocked) return { ok: false, error: res.blocked };
    revalidateAll();
    return { ok: true, message: res.deduped ? "Already logged." : "Logged." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
