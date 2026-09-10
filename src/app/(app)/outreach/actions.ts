"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, organizations, relationships } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Log outreach. Writes an interaction (the account timeline reads it), updates
 * the relationship's last-contacted, and — when marked sent — queues a follow-up
 * task via a note the recommendation engine can pick up.
 */
export async function logOutreach(formData: FormData) {
  const account = String(formData.get("account") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channel = String(formData.get("channel") ?? "email");
  if (!contact && !account) return;

  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  let organizationId: string | null = null;
  if (account) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenant.id), ilike(organizations.canonicalName, `%${account}%`)))
      .limit(1);
    organizationId = org?.id ?? null;
  }

  await db.insert(interactions).values({
    tenantId: tenant.id,
    userId: user.id,
    type: channel === "call" ? "call" : "email_sent",
    organizationId,
    subject: subject || `Outreach to ${contact || account}`,
    body: body || null,
    outcome: "sent",
    nextStep: "Follow up if no reply in 3 days",
    crmSyncStatus: "not_synced",
  });

  if (organizationId) {
    await db
      .update(relationships)
      .set({ lastContactedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(relationships.tenantId, tenant.id), eq(relationships.organizationId, organizationId)));
  }

  revalidatePath("/outreach");
  if (organizationId) revalidatePath(`/accounts/${organizationId}`);
  revalidatePath("/");
}
