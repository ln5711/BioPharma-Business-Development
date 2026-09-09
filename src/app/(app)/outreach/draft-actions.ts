"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { outreachDrafts, tasks } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { generateDraft, loadDraftContext } from "@/lib/outreach/draft";
import { AnthropicError } from "@/lib/llm";

export type DraftResult =
  | { ok: true; draftId: string; subject: string; body: string; generated: boolean }
  | { ok: false; error: string };

const ctxSchema = z.object({
  draftId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  nctId: z.string().regex(/^NCT\d{8}$/i).optional(),
  signalId: z.string().uuid().optional(),
});

/** Generate (or regenerate) a Claude draft grounded in the authorized context. */
export async function generateOutreachDraft(
  _prev: DraftResult | null,
  formData: FormData,
): Promise<DraftResult> {
  const parsed = ctxSchema.safeParse({
    draftId: formData.get("draftId") || undefined,
    personId: formData.get("personId") || undefined,
    organizationId: formData.get("organizationId") || undefined,
    nctId: formData.get("nctId") || undefined,
    signalId: formData.get("signalId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid draft context." };

  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const ctx = await loadDraftContext(tenant.id, parsed.data);

  let gen;
  try {
    gen = await generateDraft(ctx);
  } catch (err) {
    if (err instanceof AnthropicError) {
      return {
        ok: false,
        error:
          err.status === 401 || err.status === 403
            ? "The AI provider rejected the API key — set ANTHROPIC_API_KEY. You can still write the draft manually."
            : "The AI provider is unavailable. Write the draft manually or try again.",
      };
    }
    return { ok: false, error: "Could not generate a draft." };
  }

  // Upsert the draft row.
  let draftId = parsed.data.draftId ?? null;
  if (draftId) {
    const [own] = await db
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .where(
        and(
          eq(outreachDrafts.id, draftId),
          eq(outreachDrafts.tenantId, tenant.id),
          eq(outreachDrafts.userId, user.id),
        ),
      )
      .limit(1);
    if (!own) draftId = null;
  }

  if (draftId) {
    await db
      .update(outreachDrafts)
      .set({
        subject: gen.subject,
        body: gen.body,
        generatedBy: gen.meta.model ? "claude" : "user",
        evidenceRefs: ctx.evidenceRefs,
        updatedAt: new Date(),
      })
      .where(eq(outreachDrafts.id, draftId));
  } else {
    const [row] = await db
      .insert(outreachDrafts)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        personId: parsed.data.personId ?? null,
        organizationId: ctx.organization?.id ?? parsed.data.organizationId ?? null,
        recipientName: ctx.person?.name ?? null,
        recipientEmail: ctx.person?.email ?? null,
        subject: gen.subject,
        body: gen.body,
        generatedBy: gen.meta.model ? "claude" : "user",
        evidenceRefs: ctx.evidenceRefs,
      })
      .returning({ id: outreachDrafts.id });
    draftId = row.id;
  }

  revalidatePath("/outreach");
  return { ok: true, draftId, subject: gen.subject, body: gen.body, generated: Boolean(gen.meta.model) };
}

const saveSchema = z.object({
  draftId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  recipientName: z.string().max(160).optional(),
  recipientEmail: z.string().email().max(200).optional().or(z.literal("")),
  subject: z.string().max(200),
  body: z.string().max(8000),
  createFollowup: z.string().optional(),
  followupDays: z.coerce.number().int().min(1).max(30).optional(),
});

/** Save an editable draft. Never marks anything sent. */
export async function saveOutreachDraft(
  _prev: DraftResult | null,
  formData: FormData,
): Promise<DraftResult> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  if (!d.subject.trim() && !d.body.trim()) {
    return { ok: false, error: "Nothing to save — add a subject or body." };
  }
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  let draftId = d.draftId ?? null;
  if (draftId) {
    const [own] = await db
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .where(
        and(
          eq(outreachDrafts.id, draftId),
          eq(outreachDrafts.tenantId, tenant.id),
          eq(outreachDrafts.userId, user.id),
        ),
      )
      .limit(1);
    if (!own) draftId = null;
  }

  if (draftId) {
    await db
      .update(outreachDrafts)
      .set({
        subject: d.subject,
        body: d.body,
        recipientName: d.recipientName || null,
        recipientEmail: d.recipientEmail || null,
        updatedAt: new Date(),
      })
      .where(eq(outreachDrafts.id, draftId));
  } else {
    const [row] = await db
      .insert(outreachDrafts)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        personId: d.personId ?? null,
        organizationId: d.organizationId ?? null,
        recipientName: d.recipientName || null,
        recipientEmail: d.recipientEmail || null,
        subject: d.subject,
        body: d.body,
        generatedBy: "user",
      })
      .returning({ id: outreachDrafts.id });
    draftId = row.id;
  }

  // Optional real follow-up task, deduped by a stable key.
  if (d.createFollowup === "1") {
    const days = d.followupDays ?? 3;
    const dedupeKey = `outreach_draft_followup:${user.id}:${draftId}`;
    try {
      await db.insert(tasks).values({
        tenantId: tenant.id,
        userId: user.id,
        title: `Follow up on outreach: ${d.subject.slice(0, 120) || d.recipientName || "draft"}`,
        category: "follow_up",
        dueAt: new Date(Date.now() + days * 86_400_000),
        relatedOrganizationId: d.organizationId ?? null,
        source: "outreach_draft_followup",
        dedupeKey,
      });
    } catch (err) {
      const code =
        (err as { code?: string; cause?: { code?: string } })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23505") throw err;
    }
    revalidatePath("/tasks");
  }

  revalidatePath("/outreach");
  return { ok: true, draftId, subject: d.subject, body: d.body, generated: false };
}

export async function deleteOutreachDraft(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  await db
    .delete(outreachDrafts)
    .where(
      and(
        eq(outreachDrafts.id, draftId),
        eq(outreachDrafts.tenantId, tenant.id),
        eq(outreachDrafts.userId, user.id),
      ),
    );
  revalidatePath("/outreach");
}
