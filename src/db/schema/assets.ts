import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { assetStatusEnum, developmentStageEnum } from "./enums";
import { diseases, pathways, targets } from "./ontology";
import { organizations } from "./organizations";
import { tenants } from "./tenancy";

/**
 * Asset (spec §4 / §21 / §140) — a therapeutic program treated as a first-class
 * commercial object, not text buried in an account.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    canonicalName: text("canonical_name").notNull(),
    developmentCode: text("development_code"),
    brandName: text("brand_name"),
    modality: text("modality"), // small_molecule | antibody | adc | cell_therapy | ...
    mechanismOfAction: text("mechanism_of_action"),
    stage: developmentStageEnum("stage").notNull().default("unknown"),
    status: assetStatusEnum("status").notNull().default("active"),
    licensedFrom: text("licensed_from"),
    licensedTo: text("licensed_to"),
    partnerCompanies: jsonb("partner_companies").$type<string[]>().notNull().default([]),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assets_tenant_idx").on(t.tenantId),
    index("assets_org_idx").on(t.organizationId),
    uniqueIndex("assets_tenant_name_idx").on(t.tenantId, t.organizationId, t.canonicalName),
    index("assets_dev_code_idx").on(t.developmentCode),
  ],
);

export const assetAliases = pgTable(
  "asset_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalized: text("normalized").notNull(),
    kind: text("kind").notNull().default("development_code"), // development_code | generic | brand
  },
  (t) => [
    index("asset_aliases_asset_idx").on(t.assetId),
    index("asset_aliases_normalized_idx").on(t.normalized),
  ],
);

// ─── Many-to-many join tables (spec §62 — "use join tables") ───────────────

export const assetTargets = pgTable(
  "asset_targets",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => targets.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.targetId] })],
);

export const assetPathways = pgTable(
  "asset_pathways",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    pathwayId: uuid("pathway_id")
      .notNull()
      .references(() => pathways.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.pathwayId] })],
);

export const assetIndications = pgTable(
  "asset_indications",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    diseaseId: uuid("disease_id")
      .notNull()
      .references(() => diseases.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.diseaseId] })],
);
