"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { recommendationFeedback, tasks, workspaces } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { isTaskCategory } from "@/lib/task-categories";
import { seedWorkspace } from "@/lib/workspaces";

/**
 * Interpret a free-text priority the user typed on Home and route it to the
 * right object — a workspace for prep/research work, otherwise a task.
 */
export async function addQuickPriority(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const lower = text.toLowerCase();

  const wsTemplate =
    /present|deck|slides/.test(lower)
      ? "presentation"
      : /meeting|call|brief/.test(lower)
        ? "meeting_prep"
        : /research|dig into|look into|understand/.test(lower)
          ? "account_research"
          : /conference|asco|aacr|esmo|sabcs|congress/.test(lower)
            ? "conference_prep"
            : /prospect|new account|new partner|partnership/.test(lower)
              ? "outreach"
              : null;

  if (wsTemplate) {
    const [ws] = await db
      .insert(workspaces)
      .values({ tenantId: tenant.id, userId: user.id, title: title(text), template: wsTemplate, objective: text })
      .returning();
    await seedWorkspace(db, ws.id, wsTemplate as never, text);
  } else {
    const category =
      /follow.?up|reply|reconnect/.test(lower) ? "follow_up" : /publication|evidence|paper/.test(lower) ? "research" : "outreach";
    await db.insert(tasks).values({
      tenantId: tenant.id,
      userId: user.id,
      title: text.slice(0, 500),
      category: (isTaskCategory(category) ? category : "admin") as never,
    });
  }
  revalidatePath("/");
}

function title(t: string): string {
  return t.replace(/\.$/, "").replace(/^(help me |i need to )/i, "").replace(/^\w/, (c) => c.toUpperCase()).slice(0, 90);
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
