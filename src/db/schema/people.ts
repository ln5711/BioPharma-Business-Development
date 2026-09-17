import {
  boolean,
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
  contactRelevanceLabelEnum,
  emailDeliverabilityEnum,
  emailProvenanceEnum,
  interactionTypeEnum,
  outreachStatusEnum,
  relationshipHealthEnum,
  seniorityEnum,
} from "./enums";
import { organizations } from "./organizations";
import { trials } from "./trials";
import { tenants, users } from "./tenancy";

/** One source citation for a discovered fact — never an unsupported claim.
 * `url` is optional for backward compatibility with pre-existing rows, but the
 * contact-discovery pipeline always populates it — an evidence entry with no
 * URL is not treated as supporting evidence anywhere in that pipeline. */
export interface EvidenceRef {
  kind: string; // company_page | conference_bio | publication | trial_record | announcement | other
  url?: string;
  excerpt?: string;
  date?: string | null;
}

/** A single named-employee email example used to support a pattern. */
export interface EmailExample {
  name: string;
  email: string;
  sourceUrl: string;
  date?: string | null;
}

/** Everything about ONE resolved or attempted email address — kept in
 * `emailCandidates` history so correcting the preferred address never loses
 * the evidence that produced an earlier one. */
export interface EmailCandidate {
  address: string | null;
  provenance: "publicly_sourced" | "inferred_pattern" | "user_supplied" | "not_found";
  pattern: string | null; // e.g. "first.last" — null when publicly sourced / not found
  domain: string | null;
  supportingExamples: EmailExample[]; // distinct employees evidencing the pattern
  sources: EvidenceRef[]; // direct evidence for a publicly-sourced address
  confidence: "high" | "medium" | "low" | null;
  note: string | null; // e.g. "conflicting patterns found — left unresolved"
  resolvedAt: string; // ISO
}

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
    /** @deprecated superseded by `email` + provenance/deliverability below; kept
     * for backward compatibility with existing rows. */
    publicEmail: text("public_email"),
    location: text("location"),

    // ─── Contact discovery / relevance (this feature) ──────────────────────
    /** The CURRENTLY PREFERRED address. User-correctable without losing history —
     * see `emailCandidates`. Null means "email not found". */
    email: text("email"),
    emailProvenance: emailProvenanceEnum("email_provenance").notNull().default("not_found"),
    emailDeliverability: emailDeliverabilityEnum("email_deliverability").notNull().default("not_checked"),
    emailPattern: text("email_pattern"), // e.g. "first.last" — set only when inferred
    /** Full history of every candidate/attempt, most recent last — see EmailCandidate. */
    emailCandidates: jsonb("email_candidates").$type<EmailCandidate[]>().notNull().default([]),

    headshotUrl: text("headshot_url"), // NEVER generated — sourced only
    headshotSourceUrl: text("headshot_source_url"),

    description: text("description"), // concise professional description
    whyThisPerson: text("why_this_person"), // grounded in sourceEvidence
    whyNow: text("why_now"), // tied to the originating signal, when applicable

    contactLabel: contactRelevanceLabelEnum("contact_label"),
    /** Deterministic rubric breakdown, e.g. { functionFit, programEvidence,
     * useCaseFit, decisionScope, evidenceQuality }. Never a response/close probability. */
    relevanceBreakdown: jsonb("relevance_breakdown").$type<Record<string, number>>(),

    relatedAssetId: uuid("related_asset_id").references(() => assets.id, { onDelete: "set null" }),
    relatedTrialId: uuid("related_trial_id").references(() => trials.id, { onDelete: "set null" }),
    // No DB-level FK to commercial_signals — same convention as
    // interactions.signalId — to avoid a type-inference cycle between the two
    // schema files. Still indexed/joinable in application code.
    relatedSignalId: uuid("related_signal_id"),
    useCase: text("use_case"), // e.g. "ctDNA MRD monitoring" — the suggested liquid-biopsy fit

    /** Field names the user has manually edited — research refreshes must not
     * silently overwrite them; see `pendingConflicts`. */
    manualOverrides: jsonb("manual_overrides").$type<string[]>().notNull().default([]),
    /** Discovered values that disagree with a manually-overridden field,
     * awaiting the user's accept/keep decision. */
    pendingConflicts: jsonb("pending_conflicts").$type<
      { field: string; discoveredValue: string; discoveredAt: string }[]
    >().notNull().default([]),

    relevanceScore: integer("relevance_score"), // 0-100 (spec §18)
    sourceEvidence: jsonb("source_evidence").$type<EvidenceRef[]>().notNull().default([]),
    /** Last time this person's public record was (re-)researched. */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("people_tenant_idx").on(t.tenantId),
    index("people_org_idx").on(t.organizationId),
    index("people_email_idx").on(t.publicEmail),
    index("people_email2_idx").on(t.email),
    index("people_function_idx").on(t.function),
    index("people_profile_url_idx").on(t.tenantId, t.professionalProfileUrl),
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
    /** Where this specific outreach sequence stands — distinct from `health`,
     * which tracks the longer-run relationship. */
    outreachStatus: outreachStatusEnum("outreach_status").notNull().default("new"),
    favorite: boolean("favorite").notNull().default(false),
    relationshipStrength: integer("relationship_strength").notNull().default(0), // 0-100
    firstContactedAt: timestamp("first_contacted_at", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastResponseAt: timestamp("last_response_at", { withTimezone: true }),
    lastMeetingAt: timestamp("last_meeting_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    optedOut: text("opted_out"), // null | unsubscribe | do_not_contact
    notes: text("notes"),
    crmId: text("crm_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
