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
  claimKindEnum,
  signalCategoryEnum,
  signalStatusEnum,
  signalTypeEnum,
  sourceTypeEnum,
  urgencyEnum,
} from "./enums";
import { organizations } from "./organizations";
import { people } from "./people";
import { trialChanges, trials } from "./trials";
import { tenants, users } from "./tenancy";

/**
 * CommercialSignal (spec §4 — "one of the most important entities"). Produced by
 * the normalization pipeline (spec §13): raw event → entity resolution →
 * dedupe → scientific extraction → commercial classification → scoring →
 * contact + action recommendation.
 *
 * Multiple upstream sources describing the same event collapse into ONE signal
 * with several `signalSources` rows (spec §13 / §110).
 */
export const commercialSignals = pgTable(
  "commercial_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    signalType: signalTypeEnum("signal_type").notNull(),
    category: signalCategoryEnum("category").notNull(),

    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    trialId: uuid("trial_id").references(() => trials.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    trialChangeId: uuid("trial_change_id").references(() => trialChanges.id, {
      onDelete: "set null",
    }),

    headline: text("headline").notNull(),

    // FACT / INFERENCE / RECOMMENDATION kept separate (spec §56).
    factSummary: text("fact_summary").notNull(),
    scientificInterpretation: text("scientific_interpretation"),
    commercialInterpretation: text("commercial_interpretation"),
    whyItMatters: text("why_it_matters"),
    whyNow: text("why_now"),
    recommendedAction: text("recommended_action"),
    recommendedPersonas: jsonb("recommended_personas").$type<string[]>().notNull().default([]),

    urgency: urgencyEnum("urgency").notNull().default("medium"),
    opportunityScore: integer("opportunity_score"), // 0-100 (deterministic, spec §15)
    confidenceScore: integer("confidence_score"), // 0-100, SEPARATE from opportunity (spec §16)
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>().notNull().default({}),

    // Deduplication / clustering key (spec §13).
    dedupeKey: text("dedupe_key").notNull(),

    status: signalStatusEnum("status").notNull().default("new"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    sourceDate: timestamp("source_date", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("commercial_signals_tenant_idx").on(t.tenantId),
    uniqueIndex("commercial_signals_dedupe_idx").on(t.tenantId, t.dedupeKey),
    index("commercial_signals_org_idx").on(t.organizationId),
    index("commercial_signals_asset_idx").on(t.assetId),
    index("commercial_signals_trial_idx").on(t.trialId),
    index("commercial_signals_detected_idx").on(t.detectedAt),
    index("commercial_signals_score_idx").on(t.opportunityScore),
    index("commercial_signals_status_idx").on(t.status),
  ],
);

/** Provenance (spec §55) — every signal keeps its supporting sources. */
export const signalSources = pgTable(
  "signal_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => commercialSignals.id, { onDelete: "cascade" }),
    sourceType: sourceTypeEnum("source_type").notNull(),
    title: text("title"),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    excerpt: text("excerpt"),
    claimKind: claimKindEnum("claim_kind").notNull().default("fact"),
  },
  (t) => [index("signal_sources_signal_idx").on(t.signalId)],
);

/** Preference-training feedback (spec §23). */
export const signalFeedback = pgTable(
  "signal_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => commercialSignals.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    verdict: text("verdict").notNull(), // relevant | not_relevant | wrong_company | wrong_asset | wrong_interpretation | already_knew | good_opportunity | bad_opportunity
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("signal_feedback_unique_idx").on(t.signalId, t.userId, t.verdict),
  ],
);
