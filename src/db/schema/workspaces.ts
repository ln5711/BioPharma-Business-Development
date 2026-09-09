import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { tenants, users } from "./tenancy";

export const WORKSPACE_TEMPLATES = [
  "presentation",
  "meeting_prep",
  "account_research",
  "outreach",
  "conference_prep",
  "opportunity_analysis",
  "custom",
] as const;
export type WorkspaceTemplate = (typeof WORKSPACE_TEMPLATES)[number];

/** A focused working environment — where fragmented research is centralised. */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    template: text("template").notNull().default("custom"),
    objective: text("objective"),
    // Optional anchor to a target account.
    accountId: uuid("account_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"), // active | done | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspaces_tenant_user_idx").on(t.tenantId, t.userId)],
);

/** A row inside a workspace section (To-Do, Evidence, People, Notes, …). */
export const workspaceItems = pgTable(
  "workspace_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    section: text("section").notNull(), // todo | signals | assets | trials | evidence | people | notes | output
    title: text("title").notNull(),
    body: text("body"),
    done: boolean("done").notNull().default(false),
    // newwin-generated vs user-added.
    generated: boolean("generated").notNull().default(false),
    sortIndex: integer("sort_index").notNull().default(0),
    entityRef: jsonb("entity_ref").$type<{ kind: string; id: string } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspace_items_workspace_idx").on(t.workspaceId)],
);

/** Dismiss / defer / complete state for a computed Home recommendation. */
export const recommendationFeedback = pgTable(
  "recommendation_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recKey: text("rec_key").notNull(), // stable hash of the recommendation
    status: text("status").notNull(), // completed | dismissed | deferred
    until: timestamp("until", { withTimezone: true }), // for deferred
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recommendation_feedback_user_idx").on(t.userId)],
);
