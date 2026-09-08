import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_META,
  type TaskCategory,
  type TaskRow,
} from "@/lib/task-categories";

export async function listTasks(tenantId: string, userId: string): Promise<TaskRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.userId, userId)))
    .orderBy(asc(tasks.done), asc(tasks.category), desc(tasks.createdAt));
  return rows as TaskRow[];
}

export interface CategoryProgress {
  category: TaskCategory;
  label: string;
  total: number;
  done: number;
  pct: number;
}

export function summarizeProgress(rows: TaskRow[]): {
  byCategory: CategoryProgress[];
  overall: { total: number; done: number; pct: number };
} {
  const byCategory = TASK_CATEGORIES.map((category) => {
    const inCat = rows.filter((r) => r.category === category);
    const done = inCat.filter((r) => r.done).length;
    const total = inCat.length;
    return {
      category,
      label: TASK_CATEGORY_META[category].label,
      total,
      done,
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  return {
    byCategory,
    overall: { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) },
  };
}
