"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, organizations, people, relationships, tasks } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

export type OutreachResult =
  | { ok: true; followupCreated: boolean }
  | { ok: false; error: string; accountMatches?: { id: string; name: string }[] };

const MAX_MATCH = 6;

/**
 * LOG outreach that has ALREADY happened. This never sends anything — it records
 * a past interaction on the account timeline, updates last-contacted, and
 * (optionally) creates ONE real follow-up task with a due date.
 *
 * Account resolution is explicit: an ambiguous name is rejected with the list of
 * matches so the caller can pick one; it is never resolved to the first partial
 * match.
 */
export async function logOutreach(
  _prev: OutreachResult | null,
  formData: FormData,
): Promise<OutreachResult> {
  const accountName = String(formData.get("account") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 160);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const channel = String(formData.get("channel") ?? "email");
  const createFollowup = String(formData.get("createFollowup") ?? "") === "1";
  const followupDays = Math.min(30, Math.max(1, Number(formData.get("followupDays") ?? 3) || 3));

  if (!contact && !accountName && !accountId) {
    return { ok: false, error: "Enter at least a contact or an account." };
  }

  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  // ── Resolve the account (explicit, never a silent first-match) ────────────
  let organizationId: string | null = null;
  let organizationName: string | null = null;
  if (accountId) {
    const [org] = await db
      .select({ id: organizations.id, name: organizations.canonicalName })
      .from(organizations)
      .where(and(eq(organizations.id, accountId), eq(organizations.tenantId, tenant.id)))
      .limit(1);
    if (!org) return { ok: false, error: "That account no longer exists." };
    organizationId = org.id;
    organizationName = org.name;
  } else if (accountName) {
    const matches = await db
      .select({ id: organizations.id, name: organizations.canonicalName })
      .from(organizations)
      .where(
        and(
          eq(organizations.tenantId, tenant.id),
          ilike(organizations.canonicalName, `%${accountName}%`),
        ),
      )
      .limit(MAX_MATCH + 1);

    if (matches.length === 1) {
      organizationId = matches[0].id;
      organizationName = matches[0].name;
    } else if (matches.length > 1) {
      return {
        ok: false,
        error: `"${accountName}" matches ${matches.length > MAX_MATCH ? "several" : matches.length} accounts — pick one.`,
        accountMatches: matches.slice(0, MAX_MATCH),
      };
    }
    // 0 matches → log without an account link (caller sees it stays unlinked).
  }

  // ── Resolve the contact person only if unambiguous ───────────────────────
  let personId: string | null = null;
  if (contact && organizationId) {
    const ppl = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.tenantId, tenant.id),
          eq(people.organizationId, organizationId),
          ilike(people.name, `%${contact}%`),
        ),
      )
      .limit(2);
    if (ppl.length === 1) personId = ppl[0].id;
  }

  // ── Record the past interaction ─────────────────────────────────────────
  const [interaction] = await db
    .insert(interactions)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      type: channel === "call" ? "call" : "email_sent",
      organizationId,
      personId,
      subject: subject || `Logged ${channel} to ${contact || organizationName || "a contact"}`,
      body: body || null,
      outcome: "logged", // a past event the user recorded — NOT "sent by newwin"
      nextStep: createFollowup ? `Follow up in ${followupDays} days` : null,
      crmSyncStatus: "not_synced",
    })
    .returning({ id: interactions.id });

  if (organizationId) {
    await db
      .update(relationships)
      .set({ lastContactedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(relationships.tenantId, tenant.id),
          eq(relationships.organizationId, organizationId),
        ),
      );
  }

  // ── One real follow-up task, deduped ───────────────────────────────────
  let followupCreated = false;
  if (createFollowup) {
    const dueAt = new Date(Date.now() + followupDays * 86_400_000);
    const day = new Date().toISOString().slice(0, 10);
    const dedupeKey = `outreach_followup:${user.id}:${organizationId ?? contact.toLowerCase()}:${
      subject.toLowerCase() || "outreach"
    }:${day}`;
    try {
      await db.insert(tasks).values({
        tenantId: tenant.id,
        userId: user.id,
        title: `Follow up: ${subject || contact || organizationName || "logged outreach"}`,
        category: "follow_up",
        dueAt,
        relatedOrganizationId: organizationId,
        relatedInteractionId: interaction.id,
        source: "outreach_followup",
        dedupeKey,
      });
      followupCreated = true;
    } catch (err) {
      // Unique dedupeKey violation → an identical follow-up already exists today.
      const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23505") throw err;
    }
  }

  revalidatePath("/outreach");
  revalidatePath("/");
  revalidatePath("/tasks");
  if (organizationId) revalidatePath(`/accounts/${organizationId}`);

  return { ok: true, followupCreated };
}
