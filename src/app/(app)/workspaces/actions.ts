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

/**
 * Confirms the signed-in user owns `workspaceId` within their tenant. Returns
 * the workspace id when authorized, otherwise `null`. Ownership is always
 * derived from the verified session — never from a client-supplied tenant/user.
 */
async function ownedWorkspaceId(
  db: Awaited<ReturnType<typeof getDb>>,
  workspaceId: string,
  tenantId: string,
  userId: string,
): Promise<string | null> {
  if (!workspaceId) return null;
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.tenantId, tenantId),
        eq(workspaces.userId, userId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function toggleItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "1";
  if (!id) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  // Resolve the item's parent workspace, then verify the caller owns it.
  const [item] = await db
    .select({ workspaceId: workspaceItems.workspaceId })
    .from(workspaceItems)
    .where(eq(workspaceItems.id, id))
    .limit(1);
  if (!item) return;
  const wsId = await ownedWorkspaceId(db, item.workspaceId, tenant.id, user.id);
  if (!wsId) return;

  await db
    .update(workspaceItems)
    .set({ done: !done })
    .where(and(eq(workspaceItems.id, id), eq(workspaceItems.workspaceId, wsId)));
  revalidatePath(`/workspaces/${wsId}`);
}

export async function addItem(formData: FormData) {
  const wsIdRaw = String(formData.get("ws") ?? "");
  const section = String(formData.get("section") ?? "todo");
  const title = String(formData.get("title") ?? "").trim().slice(0, 400);
  if (!wsIdRaw || !title) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();

  // Verify the target workspace belongs to the caller before inserting.
  const wsId = await ownedWorkspaceId(db, wsIdRaw, tenant.id, user.id);
  if (!wsId) return;

  await db
    .insert(workspaceItems)
    .values({ workspaceId: wsId, section, title, generated: false });
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
