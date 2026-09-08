"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { isTaskCategory } from "@/lib/task-categories";

async function scope() {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  return { db, tenantId: tenant.id, userId: user.id };
}

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/progress");
}

export async function addTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "admin");
  if (!title) return;
  const category = isTaskCategory(categoryRaw) ? categoryRaw : "admin";

  const { db, tenantId, userId } = await scope();
  await db.insert(tasks).values({
    tenantId,
    userId,
    title: title.slice(0, 500),
    category,
  });
  refresh();
}

export async function setTaskDone(id: string, done: boolean) {
  const { db, tenantId, userId } = await scope();
  await db
    .update(tasks)
    .set({ done, completedAt: done ? new Date() : null })
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), eq(tasks.userId, userId)));
  refresh();
}

export async function deleteTask(id: string) {
  const { db, tenantId, userId } = await scope();
  await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), eq(tasks.userId, userId)));
  refresh();
}
