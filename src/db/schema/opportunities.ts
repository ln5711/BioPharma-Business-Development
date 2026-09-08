import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import {
  commercialTimingEnum,
  commercialUseCaseEnum,
  opportunityStageEnum,
} from "./enums";
import { organizations } from "./organizations";
import { commercialSignals } from "./signals";
import { trials } from "./trials";
import { tenants, users } from "./tenancy";

/**
 * Opportunity (spec §4 / §15 / §86). Scores are computed by deterministic code
 * (spec §57 — "Do NOT let the LLM arbitrarily generate this number"); the
 * component breakdown is always exposed for explainability.
 */
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    trialId: uuid("trial_id").references(() => trials.id, { onDelete: "set null" }),
    originSignalId: uuid("origin_signal_id").references(() => commercialSignals.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    indication: text("indication"),
    commercialUseCase: commercialUseCaseEnum("commercial_use_case"),
    isProspective: text("is_prospective").notNull().default("prospective"), // prospective | retrospective (spec §17)
    stage: opportunityStageEnum("stage").notNull().default("identified"),
    timing: commercialTimingEnum("timing").notNull().default("ideal"),

    opportunityScore: integer("opportunity_score").notNull().default(0), // 0-100
    confidenceScore: integer("confidence_score").notNull().default(0), // 0-100
    estimatedValue: numeric("estimated_value"),
    probability: numeric("probability"),

    whyNow: text("why_now"),
    nextAction: text("next_action"),
    nextActionDate: timestamp("next_action_date", { withTimezone: true }),
    competitorStatus: text("competitor_status"),

    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    crmOpportunityId: text("crm_opportunity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("opportunities_tenant_idx").on(t.tenantId),
    index("opportunities_org_idx").on(t.organizationId),
    index("opportunities_score_idx").on(t.opportunityScore),
    index("opportunities_stage_idx").on(t.stage),
  ],
);

/**
 * Interpretable score components (spec §86). One row per opportunity holding the
 * seven sub-scores plus the human-readable rationale for each.
 */
export const opportunityScoreComponents = pgTable(
  "opportunity_score_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    scoringProfileId: uuid("scoring_profile_id"),
    commercialFit: integer("commercial_fit").notNull().default(0), // /25
    clinicalTiming: integer("clinical_timing").notNull().default(0), // /20
    biomarkerNeed: integer("biomarker_need").notNull().default(0), // /20
    relationshipAccessibility: integer("relationship_accessibility").notNull().default(0), // /10
    signalStrength: integer("signal_strength").notNull().default(0), // /10
    accountStrategicValue: integer("account_strategic_value").notNull().default(0), // /10
    urgency: integer("urgency").notNull().default(0), // /5
    total: integer("total").notNull().default(0), // /100
    rationale: jsonb("rationale").$type<Record<string, string>>().notNull().default({}),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("opportunity_score_components_opp_idx").on(t.opportunityId)],
);
