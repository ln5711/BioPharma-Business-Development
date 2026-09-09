"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, users } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import {
  addPriority as addPriorityStore,
  editPriority as editPriorityStore,
  movePriority as movePriorityStore,
  removePriority as removePriorityStore,
  setPriorityPaused,
} from "@/lib/priorities-store";
import { createSession, revokeSessions, hashPassword, verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/auth";

function revalidatePriorities() {
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function addPriority(formData: FormData) {
  const text = String(formData.get("text") ?? "");
  const recommendedId = String(formData.get("recommendedId") ?? "") || undefined;
  const { tenant, user } = await getActiveTenant();
  await addPriorityStore(user.id, tenant.id, { text, recommendedId });
  revalidatePriorities();
}

export async function editPriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const text = String(formData.get("text") ?? "");
  const { tenant, user } = await getActiveTenant();
  await editPriorityStore(user.id, tenant.id, id, text);
  revalidatePriorities();
}

export async function removePriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { tenant, user } = await getActiveTenant();
  await removePriorityStore(user.id, tenant.id, id);
  revalidatePriorities();
}

export async function movePriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "") === "up" ? "up" : "down";
  const { tenant, user } = await getActiveTenant();
  await movePriorityStore(user.id, tenant.id, id, dir);
  revalidatePriorities();
}

export async function togglePriorityPause(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const paused = String(formData.get("paused") ?? "") === "1";
  const { tenant, user } = await getActiveTenant();
  // `paused` is the CURRENT state; flip it.
  await setPriorityPaused(user.id, tenant.id, id, !paused);
  revalidatePriorities();
}

export async function updateProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const position = String(formData.get("position") ?? "").trim().slice(0, 120);
  const { user } = await getActiveTenant();
  const db = await getDb();
  if (name) {
    await db
      .update(users)
      .set({ name, position: position || null })
      .where(eq(users.id, user.id));
  }
  revalidatePath("/", "layout");
}

export async function updateOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const domain = String(formData.get("domain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  if (name) {
    await db
      .update(tenants)
      .set({ name, domain: domain || null, website: domain ? `https://${domain}` : null })
      .where(eq(tenants.id, tenant.id));
  }
  revalidatePath("/", "layout");
}

export type PasswordResult = { ok: true } | { ok: false; error: string };

/** Change password — verifies the current one, then revokes all other sessions. */
export async function changePassword(
  _prev: PasswordResult | null,
  formData: FormData,
): Promise<PasswordResult> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return { ok: false, error: "New password must be at least 8 characters." };

  const { user } = await getActiveTenant();
  const db = await getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !verifyPassword(current, row.passwordHash)) {
    return { ok: false, error: "Current password is incorrect." };
  }

  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
  await revokeSessions(user.id); // kill every existing session…
  const session = await getSession();
  if (session) {
    // …then re-issue one for THIS device so the user isn't bounced out.
    await createSession({ userId: session.userId, tenantId: session.tenantId });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
