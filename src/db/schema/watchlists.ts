import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sourceHealthEnum, sourceTypeEnum, watchlistEntityKindEnum } from "./enums";
import { tenants, users } from "./tenancy";

/**
 * Watchlist (spec §50) — a saved set of entities/keywords with its own scoring
 * threshold and alerting cadence. The RAS/KRAS demo watchlist (spec §81 / §116)
 * is seeded by `scripts/seed.ts`.
 */
export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    minOpportunityScore: integer("min_opportunity_score").notNull().default(50),
    alertMode: text("alert_mode").notNull().default("daily_digest"), // immediate | daily_digest | weekly_summary
    // Structured query used by the ClinicalTrials.gov adapter (spec §6 / §116).
    ctgovQuery: jsonb("ctgov_query").$type<{
      terms: string[];
      conditions: string[];
      phases?: string[];
      statuses?: string[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("watchlists_tenant_idx").on(t.tenantId),
    uniqueIndex("watchlists_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    entityKind: watchlistEntityKindEnum("entity_kind").notNull(),
    entityId: uuid("entity_id"), // null for free-text keywords
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("watchlist_items_watchlist_idx").on(t.watchlistId),
    index("watchlist_items_kind_idx").on(t.entityKind),
  ],
);

/**
 * Source Registry (spec §6 / §78 / §79) — the admin-managed catalog of every
 * ingestion source with health telemetry. ClinicalTrials.gov registers one row
 * per tenant watchlist query.
 */
export const sourceRegistry = pgTable(
  "source_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    authorityLevel: text("authority_level").notNull().default("primary"), // primary | secondary | tertiary
    accessMethod: text("access_method").notNull().default("api"), // api | rss | sitemap | http | manual
    url: text("url"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    updateFrequencyMinutes: integer("update_frequency_minutes").notNull().default(1440),
    reliabilityScore: integer("reliability_score").notNull().default(90),
    robotsAllowed: text("robots_allowed").notNull().default("allowed"),

    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastChangeAt: timestamp("last_change_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
    health: sourceHealthEnum("health").notNull().default("healthy"),

    // Rolling value attribution (spec §76).
    signalsProduced: integer("signals_produced").notNull().default(0),
    opportunitiesProduced: integer("opportunities_produced").notNull().default(0),
    meetingsProduced: integer("meetings_produced").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_registry_tenant_idx").on(t.tenantId),
    index("source_registry_type_idx").on(t.sourceType),
    index("source_registry_health_idx").on(t.health),
  ],
);

/** Structured, idempotent, observable background-job runs (spec §60). */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    jobName: text("job_name").notNull(),
    status: text("status").notNull().default("running"), // running | success | error
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    stats: jsonb("stats").$type<Record<string, number | string>>().notNull().default({}),
    error: text("error"),
  },
  (t) => [
    index("job_runs_name_idx").on(t.jobName),
    index("job_runs_started_idx").on(t.startedAt),
  ],
);
