import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import {
  changeSeverityEnum,
  trialPhaseEnum,
  trialStatusEnum,
} from "./enums";
import { biomarkers, diseases } from "./ontology";
import { organizations } from "./organizations";
import { tenants } from "./tenancy";

/**
 * Trial (spec §4 / §6). One row per NCT id per tenant. Current values live here;
 * every observed version is preserved in `trialSnapshots`, and every field-level
 * delta becomes a first-class `trialChanges` row (spec §4 — "Trial changes must
 * be FIRST-CLASS OBJECTS. Do not merely overwrite a trial record.").
 */
export const trials = pgTable(
  "trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    nctId: text("nct_id").notNull(),
    title: text("title"),
    officialTitle: text("official_title"),

    sponsorName: text("sponsor_name"),
    sponsorOrganizationId: uuid("sponsor_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    collaborators: jsonb("collaborators").$type<string[]>().notNull().default([]),

    phase: trialPhaseEnum("phase").notNull().default("unknown"),
    status: trialStatusEnum("status").notNull().default("unknown"),
    studyType: text("study_type"),
    enrollment: integer("enrollment"),
    enrollmentType: text("enrollment_type"), // actual | estimated

    conditionsRaw: jsonb("conditions_raw").$type<string[]>().notNull().default([]),
    interventionsRaw: jsonb("interventions_raw").$type<
      { type: string; name: string }[]
    >().notNull().default([]),
    armsRaw: jsonb("arms_raw").$type<
      { label: string; type?: string; description?: string }[]
    >().notNull().default([]),

    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    locationCount: integer("location_count"),
    locationsRaw: jsonb("locations_raw").$type<
      { facility?: string; city?: string; state?: string; country?: string; status?: string }[]
    >().notNull().default([]),

    eligibilityText: text("eligibility_text"),
    primaryEndpoints: jsonb("primary_endpoints").$type<string[]>().notNull().default([]),
    secondaryEndpoints: jsonb("secondary_endpoints").$type<string[]>().notNull().default([]),
    exploratoryEndpoints: jsonb("exploratory_endpoints").$type<string[]>().notNull().default([]),

    startDate: timestamp("start_date", { withTimezone: true }),
    primaryCompletionDate: timestamp("primary_completion_date", { withTimezone: true }),
    completionDate: timestamp("completion_date", { withTimezone: true }),
    lastCtgovUpdate: timestamp("last_ctgov_update", { withTimezone: true }),

    // ─── Derived commercial-intelligence flags (spec §6 / §141) ────────────
    molecularEligibility: boolean("molecular_eligibility").notNull().default(false),
    biomarkerRequirements: jsonb("biomarker_requirements").$type<string[]>().notNull().default([]),
    ctdnaMentions: boolean("ctdna_mentions").notNull().default(false),
    mrdMentions: boolean("mrd_mentions").notNull().default(false),
    ngsMentions: boolean("ngs_mentions").notNull().default(false),
    resistanceMonitoringMentions: boolean("resistance_monitoring_mentions").notNull().default(false),
    centralLabMentions: boolean("central_lab_mentions").notNull().default(false),
    biospecimenRetention: text("biospecimen_retention"), // none | samples_with_dna | samples_without_dna
    serialSamplingMentions: boolean("serial_sampling_mentions").notNull().default(false),
    commercialSummary: text("commercial_summary"),

    recordVersionHash: text("record_version_hash").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trials_tenant_idx").on(t.tenantId),
    uniqueIndex("trials_tenant_nct_idx").on(t.tenantId, t.nctId),
    index("trials_nct_idx").on(t.nctId),
    index("trials_sponsor_org_idx").on(t.sponsorOrganizationId),
    index("trials_status_idx").on(t.status),
    index("trials_phase_idx").on(t.phase),
    index("trials_hash_idx").on(t.recordVersionHash),
  ],
);

/**
 * Immutable snapshot of the normalized trial record at a point in time
 * (spec §6 — "Store previous snapshots. Diff them."). `payload` holds the full
 * normalized object; `rawPayload` keeps the upstream API study for audit.
 */
export const trialSnapshots = pgTable(
  "trial_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trialId: uuid("trial_id")
      .notNull()
      .references(() => trials.id, { onDelete: "cascade" }),
    nctId: text("nct_id").notNull(),
    recordVersionHash: text("record_version_hash").notNull(),
    ctgovLastUpdate: timestamp("ctgov_last_update", { withTimezone: true }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trial_snapshots_trial_idx").on(t.trialId),
    uniqueIndex("trial_snapshots_trial_hash_idx").on(t.trialId, t.recordVersionHash),
    index("trial_snapshots_captured_idx").on(t.capturedAt),
  ],
);

/**
 * TrialChange (spec §4) — WHAT changed, WHEN, HOW important, plus a first pass
 * at commercial relevance. Consumed by the signal engine (spec §14).
 */
export const trialChanges = pgTable(
  "trial_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    trialId: uuid("trial_id")
      .notNull()
      .references(() => trials.id, { onDelete: "cascade" }),
    nctId: text("nct_id").notNull(),
    fromSnapshotId: uuid("from_snapshot_id").references(() => trialSnapshots.id, {
      onDelete: "set null",
    }),
    toSnapshotId: uuid("to_snapshot_id").references(() => trialSnapshots.id, {
      onDelete: "set null",
    }),
    fieldChanged: text("field_changed").notNull(),
    oldValue: jsonb("old_value").$type<unknown>(),
    newValue: jsonb("new_value").$type<unknown>(),
    severity: changeSeverityEnum("severity").notNull().default("minor"),
    commercialRelevance: integer("commercial_relevance").notNull().default(0), // 0-100
    summary: text("summary").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    sourceTimestamp: timestamp("source_timestamp", { withTimezone: true }),
  },
  (t) => [
    index("trial_changes_tenant_idx").on(t.tenantId),
    index("trial_changes_trial_idx").on(t.trialId),
    index("trial_changes_detected_idx").on(t.detectedAt),
    uniqueIndex("trial_changes_dedupe_idx").on(
      t.trialId,
      t.fieldChanged,
      t.toSnapshotId,
    ),
  ],
);

// ─── Join tables ─────────────────────────────────────────────────────────────

export const trialAssets = pgTable(
  "trial_assets",
  {
    trialId: uuid("trial_id")
      .notNull()
      .references(() => trials.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    matchConfidence: integer("match_confidence").notNull().default(60), // 0-100
    matchEvidence: text("match_evidence"),
  },
  (t) => [primaryKey({ columns: [t.trialId, t.assetId] })],
);

export const trialConditions = pgTable(
  "trial_conditions",
  {
    trialId: uuid("trial_id")
      .notNull()
      .references(() => trials.id, { onDelete: "cascade" }),
    diseaseId: uuid("disease_id")
      .notNull()
      .references(() => diseases.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.trialId, t.diseaseId] })],
);

export const trialBiomarkers = pgTable(
  "trial_biomarkers",
  {
    trialId: uuid("trial_id")
      .notNull()
      .references(() => trials.id, { onDelete: "cascade" }),
    biomarkerId: uuid("biomarker_id")
      .notNull()
      .references(() => biomarkers.id, { onDelete: "cascade" }),
    role: text("role"), // eligibility | endpoint | stratification
  },
  (t) => [primaryKey({ columns: [t.trialId, t.biomarkerId] })],
);
