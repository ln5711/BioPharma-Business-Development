import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants, users } from "./tenancy";

/**
 * Fixed-window usage counter, shared across instances via Postgres (not an
 * in-process Map). One row per (scope, windowStart). Used to bound Ask newwin /
 * LLM calls per user + per workspace.
 */
export const usageCounters = pgTable(
  "usage_counters",
  {
    scope: text("scope").notNull(), // e.g. "ask:user:<uuid>" | "ask:tenant:<uuid>"
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.scope, t.windowStart] })],
);

/**
 * Ask newwin conversations, scoped to the authenticated user + workspace.
 * Retrieval and updates are always filtered by (tenantId, userId).
 */
export const askConversations = pgTable(
  "ask_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ask_conversations_owner_idx").on(t.tenantId, t.userId, t.updatedAt)],
);

/**
 * Cache of public research results (web + ClinicalTrials.gov) keyed by a hash of
 * the normalised query. Bounds provider usage and speeds up repeat searches.
 * Entries are treated as stale by the reader after a short TTL (~30 min); rows
 * are not user- or tenant-scoped because the payload is purely public data.
 */
export const researchCache = pgTable(
  "research_cache",
  {
    key: text("key").primaryKey(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("research_cache_created_idx").on(t.createdAt)],
);

export const askMessages = pgTable(
  "ask_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => askConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    /** For assistant turns: the AskResponse (cards, sources, meta) it produced. */
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ask_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);
