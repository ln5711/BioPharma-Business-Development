/**
 * Client-safe task constants and types (no server-only imports, no db access).
 * Categories map to the BD next-best-action families (spec §72).
 */
export const TASK_CATEGORIES = [
  "outreach",
  "research",
  "follow_up",
  "meeting_prep",
  "admin",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_META: Record<
  TaskCategory,
  { label: string; blurb: string }
> = {
  outreach: { label: "Outreach", blurb: "First-touch emails, intros, LinkedIn notes" },
  research: { label: "Research", blurb: "Account, asset, and trial digging" },
  follow_up: { label: "Follow-up", blurb: "Chase-ups, replies, sequence steps" },
  meeting_prep: { label: "Meeting prep", blurb: "Briefs and agendas before a call" },
  admin: { label: "Admin", blurb: "CRM hygiene, notes, internal coordination" },
};

export function isTaskCategory(v: unknown): v is TaskCategory {
  return typeof v === "string" && (TASK_CATEGORIES as readonly string[]).includes(v);
}

export interface TaskRow {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  category: TaskCategory;
  notes: string | null;
  done: boolean;
  completedAt: Date | null;
  createdAt: Date;
}
