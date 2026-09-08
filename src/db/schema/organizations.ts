import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  accountTierEnum,
  organizationTypeEnum,
  sourceHealthEnum,
  sourcePageCategoryEnum,
  sourceTypeEnum,
} from "./enums";
import { tenants } from "./tenancy";

/**
 * Organization (spec §4). Companies are shared reference data scoped by tenant
 * so each customer keeps its own account tiering and relationship state.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    canonicalName: text("canonical_name").notNull(),
    organizationType: organizationTypeEnum("organization_type").notNull().default("biotech"),
    parentCompanyId: uuid("parent_company_id"),
    website: text("website"),
    canonicalDomain: text("canonical_domain"),
    headquarters: text("headquarters"),
    isPublic: boolean("is_public").notNull().default(false),
    ticker: text("ticker"),
    cik: text("cik"),
    description: text("description"),
    employeeEstimate: integer("employee_estimate"),
    oncologyFocus: boolean("oncology_focus").notNull().default(true),

    // Tenant-specific commercial framing.
    accountTier: accountTierEnum("account_tier").notNull().default("standard"),
    accountScore: integer("account_score"), // 0-100, spec §43 (distinct from asset opportunity score)
    ownerUserId: uuid("owner_user_id"),

    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("organizations_tenant_idx").on(t.tenantId),
    uniqueIndex("organizations_tenant_name_idx").on(t.tenantId, t.canonicalName),
    index("organizations_domain_idx").on(t.canonicalDomain),
    index("organizations_ticker_idx").on(t.ticker),
  ],
);

/** Alias table (spec §54) — "JNJ / Johnson & Johnson / Janssen / Janssen Biotech". */
export const organizationAliases = pgTable(
  "organization_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalized: text("normalized").notNull(), // lowercased, punctuation-stripped
    kind: text("kind").notNull().default("name"), // name | former_name | subsidiary | ticker
  },
  (t) => [
    index("organization_aliases_org_idx").on(t.organizationId),
    index("organization_aliases_normalized_idx").on(t.normalized),
  ],
);

/**
 * OrganizationSource (spec §4 / §7) — registered official pages/feeds to monitor.
 * Snapshot/hash fields support cheap change detection (spec §53 / §85).
 */
export const organizationSources = pgTable(
  "organization_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceType: sourceTypeEnum("source_type").notNull().default("company_web"),
    pageCategory: sourcePageCategoryEnum("page_category").notNull().default("newsroom"),
    url: text("url").notNull(),
    feedUrl: text("feed_url"),
    enabled: boolean("enabled").notNull().default(true),
    crawlFrequencyMinutes: integer("crawl_frequency_minutes").notNull().default(1440),
    robotsAllowed: boolean("robots_allowed").notNull().default(true),
    parser: text("parser").notNull().default("generic_html"),
    reliabilityScore: integer("reliability_score").notNull().default(70), // 0-100

    etag: text("etag"),
    contentHash: text("content_hash"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    lastHttpStatus: integer("last_http_status"),
    health: sourceHealthEnum("health").notNull().default("healthy"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("organization_sources_org_idx").on(t.organizationId),
    uniqueIndex("organization_sources_url_idx").on(t.organizationId, t.url),
    index("organization_sources_enabled_idx").on(t.enabled),
  ],
);

/**
 * Publicly announced partner / competitor relationships (spec §44).
 * Evidence is required; scope is classified rather than assumed exclusive.
 */
export const organizationPartners = pgTable(
  "organization_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    partnerName: text("partner_name").notNull(),
    partnerType: text("partner_type").notNull(), // diagnostics | cro | central_lab | sequencing | cdx
    assetId: uuid("asset_id"),
    status: text("status").notNull().default("unknown"), // partner_status enum values
    scope: text("scope").notNull().default("unknown_scope"), // partner_scope enum values
    evidenceUrl: text("evidence_url"),
    evidenceExcerpt: text("evidence_excerpt"),
    announcedAt: timestamp("announced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("organization_partners_org_idx").on(t.organizationId)],
);

/** Denormalized per-function relationship coverage (spec §38 / §121). */
export const accountCoverage = pgTable(
  "account_coverage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    function: text("function").notNull(), // buyer_function enum values
    strength: text("strength").notNull().default("none"), // none | weak | moderate | strong
    contactCount: integer("contact_count").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_coverage_org_fn_idx").on(t.organizationId, t.function),
  ],
);
