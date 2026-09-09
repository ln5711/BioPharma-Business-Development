"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants, userPreferences, users, type Priority } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

async function loadPrefs(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return { db, row };
}

async function savePriorities(userId: string, tenantId: string, priorities: Priority[]) {
  const db = await getDb();
  const ordered = priorities.map((p, i) => ({ ...p, order: i }));
  await db
    .insert(userPreferences)
    .values({ userId, tenantId, priorities: ordered, onboardedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { priorities: ordered, updatedAt: new Date() },
    });
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function addPriority(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  const { tenant, user } = await getActiveTenant();
  const { row } = await loadPrefs(user.id);
  const list: Priority[] = row?.priorities ?? [];
  list.push({ id: randomUUID(), text, paused: false, order: list.length });
  await savePriorities(user.id, tenant.id, list);
}

export async function removePriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { tenant, user } = await getActiveTenant();
  const { row } = await loadPrefs(user.id);
  await savePriorities(user.id, tenant.id, (row?.priorities ?? []).filter((p) => p.id !== id));
}

export async function movePriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const { tenant, user } = await getActiveTenant();
  const { row } = await loadPrefs(user.id);
  const list = [...(row?.priorities ?? [])].sort((a, b) => a.order - b.order);
  const i = list.findIndex((p) => p.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await savePriorities(user.id, tenant.id, list);
}

export async function togglePriorityPause(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { tenant, user } = await getActiveTenant();
  const { row } = await loadPrefs(user.id);
  await savePriorities(
    user.id,
    tenant.id,
    (row?.priorities ?? []).map((p) => (p.id === id ? { ...p, paused: !p.paused } : p)),
  );
}

export async function updateProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const { user } = await getActiveTenant();
  const db = await getDb();
  if (name) await db.update(users).set({ name, position: position || null }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}

export async function updateOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  if (name)
    await db
      .update(tenants)
      .set({ name, domain: domain || null, website: domain ? `https://${domain}` : null })
      .where(eq(tenants.id, tenant.id));
  revalidatePath("/", "layout");
}
