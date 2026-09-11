import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { taskCategoryEnum } from "./enums";
import { organizations } from "./organizations";
import { tenants, users } from "./tenancy";

/**
 * Lightweight task list — a notepad/checklist for the BD workday. Each task is
 * tagged with one next-best-action category (spec §72) and can carry a due date
 * plus a link back to the account / interaction that created it.
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
    dueAt: timestamp("due_at", { withTimezone: true }),
    relatedOrganizationId: uuid("related_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    relatedInteractionId: uuid("related_interaction_id"),
    // Provenance + idempotency key, e.g. "outreach_followup". NULL for manual tasks.
    source: text("source"),
    // Stable natural key for machine-created tasks so retries don't duplicate.
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_tenant_user_idx").on(t.tenantId, t.userId),
    index("tasks_category_idx").on(t.category),
    index("tasks_done_idx").on(t.done),
    index("tasks_due_idx").on(t.dueAt),
    uniqueIndex("tasks_dedupe_idx").on(t.tenantId, t.dedupeKey),
  ],
);
