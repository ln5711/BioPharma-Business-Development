import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { taskCategoryEnum } from "./enums";
import { tenants, users } from "./tenancy";

/**
 * Lightweight task list — a notepad/checklist for the BD workday. Each task is
 * tagged with one next-best-action category (spec §72). Not linked to signals
 * or accounts yet; that association is a later refinement.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: taskCategoryEnum("category").notNull().default("admin"),
    notes: text("notes"),
    done: boolean("done").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_tenant_user_idx").on(t.tenantId, t.userId),
    index("tasks_category_idx").on(t.category),
    index("tasks_done_idx").on(t.done),
  ],
);
