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
import { assets } from "./assets";
import {
  buyerFunctionEnum,
  interactionTypeEnum,
  relationshipHealthEnum,
  seniorityEnum,
} from "./enums";
import { organizations } from "./organizations";
import { trials } from "./trials";
import { tenants, users } from "./tenancy";

/**
 * Person (spec §4 / §18). Professional / relevant information only — the schema
 * deliberately has no fields for sensitive personal attributes (spec §66).
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    title: text("title"),
    department: text("department"),
    seniority: seniorityEnum("seniority").notNull().default("unknown"),
    function: buyerFunctionEnum("function").notNull().default("other"),
    professionalProfileUrl: text("professional_profile_url"),
    publicEmail: text("public_email"),
    location: text("location"),

    relevanceScore: integer("relevance_score"), // 0-100 (spec §18)
    sourceEvidence: jsonb("source_evidence").$type<
      { kind: string; url?: string; excerpt?: string }[]
    >().notNull().default([]),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("people_tenant_idx").on(t.tenantId),
    index("people_org_idx").on(t.organizationId),
    index("people_email_idx").on(t.publicEmail),
    index("people_function_idx").on(t.function),
  ],
);

/**
 * Contact ↔ asset evidence (spec §19) — "Every claim that a person works on an
 * asset should carry evidence. Never invent asset associations based purely on
 * company employment."
 */
export const personAssetEvidence = pgTable(
  "person_asset_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    trialId: uuid("trial_id").references(() => trials.id, { onDelete: "cascade" }),
    evidenceKind: text("evidence_kind").notNull(), // publication_coauthor | trial_contact | speaker | job_title
    confidence: integer("confidence").notNull().default(50), // 0-100
    url: text("url"),
    excerpt: text("excerpt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("person_asset_evidence_person_idx").on(t.personId),
    index("person_asset_evidence_asset_idx").on(t.assetId),
  ],
);

/** Relationship (spec §4 / §38) — tenant + owner scoped relationship state. */
export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    health: relationshipHealthEnum("health").notNull().default("none"),
    relationshipStrength: integer("relationship_strength").notNull().default(0), // 0-100
    firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastResponseAt: timestamp("last_response_at", { withTimezone: true }),
    lastMeetingAt: timestamp("last_meeting_at", { withTimezone: true }),
    optedOut: text("opted_out"), // null | unsubscribe | do_not_contact
    notes: text("notes"),
    crmId: text("crm_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("relationships_tenant_person_idx").on(t.tenantId, t.personId),
    index("relationships_org_idx").on(t.organizationId),
    index("relationships_owner_idx").on(t.ownerUserId),
  ],
);

/** Interaction (spec §4) — the CRM-ready activity log. */
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: interactionTypeEnum("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    signalId: uuid("signal_id"),
    campaignId: uuid("campaign_id"),
    subject: text("subject"),
    body: text("body"),
    response: text("response"),
    outcome: text("outcome"),
    nextStep: text("next_step"),
    crmSyncStatus: text("crm_sync_status").notNull().default("not_synced"), // not_synced | pending | synced | error
    crmId: text("crm_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interactions_tenant_idx").on(t.tenantId),
    index("interactions_person_idx").on(t.personId),
    index("interactions_org_idx").on(t.organizationId),
    index("interactions_occurred_idx").on(t.occurredAt),
  ],
);
