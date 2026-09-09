"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { recommendationFeedback } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { addPriority } from "@/lib/priorities-store";

export type QuickPriorityResult = { ok: true } | { ok: false; error: string };

/**
 * Adds a REAL saved priority from Home. The text is stored in
 * `user_preferences.priorities`, so it immediately shows in the list and starts
 * influencing recommendation matching (same model as recommended priorities and
 * the Settings editor).
 */
export async function addQuickPriority(
  _prev: QuickPriorityResult | null,
  formData: FormData,
): Promise<QuickPriorityResult> {
  const text = String(formData.get("text") ?? "");
  const { tenant, user } = await getActiveTenant();
  const res = await addPriority(user.id, tenant.id, { text });
  revalidatePath("/");
  revalidatePath("/settings");
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Could not add priority." };
}

export async function recFeedback(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!key || !["completed", "dismissed", "deferred"].includes(status)) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  await db.insert(recommendationFeedback).values({
    tenantId: tenant.id,
    userId: user.id,
    recKey: key,
    status,
    until: status === "deferred" ? new Date(Date.now() + 864e5) : null,
  });
  revalidatePath("/");
}
