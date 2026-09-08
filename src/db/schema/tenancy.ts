import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tenancy & configuration.
 *
 * Every customer is a `tenant`. A tenant owns exactly one capability profile
 * (what they sell — spec §3) and one or more scoring profiles (spec §88).
 * Nearly every downstream table carries `tenantId` for row-level isolation.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  position: text("position"), // job title / role, captured at onboarding
  role: text("role").notNull().default("member"), // member | manager | admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * First-run onboarding (one row per user). The presence of `completedAt` gates
 * the welcome flow so it is shown exactly once.
 */
export const userOnboarding = pgTable("user_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: text("position").notNull(),
  weeklyAim: text("weekly_aim").notNull(),
  goals: jsonb("goals").$type<string[]>().notNull().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Company Capability Profile (spec §3). Drives all opportunity scoring —
 * "the system cannot assume every customer has the same commercial opportunity".
 */
export const capabilityProfiles = pgTable("capability_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  website: text("website"),
  description: text("description"),

  // Free-form capability inventory — flexible by design (spec §3 lists ~40 fields).
  productsServices: jsonb("products_services").$type<string[]>().notNull().default([]),
  testingModalities: jsonb("testing_modalities").$type<string[]>().notNull().default([]),
  sampleTypes: jsonb("sample_types").$type<string[]>().notNull().default([]),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([]),
  genesCovered: jsonb("genes_covered").$type<string[]>().notNull().default([]),
  biomarkersCovered: jsonb("biomarkers_covered").$type<string[]>().notNull().default([]),
  cancerTypes: jsonb("cancer_types").$type<string[]>().notNull().default([]),
  clinicalStagesSupported: jsonb("clinical_stages_supported").$type<string[]>().notNull().default([]),
  geographies: jsonb("geographies").$type<string[]>().notNull().default([]),
  regulatoryStatus: jsonb("regulatory_status").$type<string[]>().notNull().default([]),
  capabilityFlags: jsonb("capability_flags").$type<Record<string, boolean>>().notNull().default({}),

  // Strategy (spec §3).
  mustPursue: jsonb("must_pursue").$type<string[]>().notNull().default([]),
  desirable: jsonb("desirable").$type<string[]>().notNull().default([]),
  exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
  competitiveConflicts: jsonb("competitive_conflicts").$type<string[]>().notNull().default([]),
  targetIndications: jsonb("target_indications").$type<string[]>().notNull().default([]),
  targetPathways: jsonb("target_pathways").$type<string[]>().notNull().default([]),
  targetAccountTypes: jsonb("target_account_types").$type<string[]>().notNull().default([]),
  trialStagesOfInterest: jsonb("trial_stages_of_interest").$type<string[]>().notNull().default([]),
  minimumOpportunityScore: integer("minimum_opportunity_score").notNull().default(50),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Configurable scoring weights (spec §15 / §88). The default row mirrors the
 * canonical 25/20/20/10/10/10/5 model; customers can add alternates.
 */
export const scoringProfiles = pgTable("scoring_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  weights: jsonb("weights")
    .$type<{
      commercialFit: number;
      clinicalTiming: number;
      biomarkerNeed: number;
      relationshipAccessibility: number;
      signalStrength: number;
      accountStrategicValue: number;
      urgency: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Persisted user corrections (spec §87) — "Wrong asset / Not an opportunity /
 * already has partner …". Replayed as tenant-specific rules during scoring.
 */
export const aiCorrections = pgTable("ai_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  subjectType: text("subject_type").notNull(), // signal | opportunity | person | asset
  subjectId: uuid("subject_id").notNull(),
  correctionType: text("correction_type").notNull(), // wrong_asset | not_opportunity | has_partner | persona_rank | pathway_priority
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
