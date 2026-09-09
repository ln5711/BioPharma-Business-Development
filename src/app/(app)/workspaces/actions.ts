"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceItems, workspaces } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { seedWorkspace, TEMPLATE_META } from "@/lib/workspaces";

export async function createWorkspace(formData: FormData) {
  const template = String(formData.get("template") ?? "custom");
  const objective = String(formData.get("objective") ?? "").trim();
  if (!(template in TEMPLATE_META)) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  const title =
    objective.slice(0, 90) ||
    `${TEMPLATE_META[template as keyof typeof TEMPLATE_META].label} workspace`;

  const [ws] = await db
    .insert(workspaces)
    .values({ tenantId: tenant.id, userId: user.id, title, template, objective: objective || null })
    .returning();
  await seedWorkspace(db, ws.id, template as never, objective || title);
  revalidatePath("/workspaces");
  redirect(`/workspaces/${ws.id}`);
}

export async function toggleItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "1";
  const wsId = String(formData.get("ws") ?? "");
  if (!id) return;
  const { tenant } = await getActiveTenant();
  const db = await getDb();
  await db
    .update(workspaceItems)
    .set({ done: !done })
    .where(eq(workspaceItems.id, id));
  void tenant;
  revalidatePath(`/workspaces/${wsId}`);
}

export async function addItem(formData: FormData) {
  const wsId = String(formData.get("ws") ?? "");
  const section = String(formData.get("section") ?? "todo");
  const title = String(formData.get("title") ?? "").trim();
  if (!wsId || !title) return;
  const db = await getDb();
  await db.insert(workspaceItems).values({ workspaceId: wsId, section, title, generated: false });
  revalidatePath(`/workspaces/${wsId}`);
}

export async function setWorkspaceStatus(formData: FormData) {
  const wsId = String(formData.get("ws") ?? "");
  const status = String(formData.get("status") ?? "active");
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  await db
    .update(workspaces)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(workspaces.id, wsId), eq(workspaces.tenantId, tenant.id), eq(workspaces.userId, user.id)),
    );
  revalidatePath("/workspaces");
  revalidatePath(`/workspaces/${wsId}`);
}
