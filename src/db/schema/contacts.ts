import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { commercialSignals } from "./signals";
import {
  buyerFunctionEnum,
  contactRelevanceLabelEnum,
  discoveryJobStatusEnum,
  emailDeliverabilityEnum,
  emailProvenanceEnum,
  seniorityEnum,
} from "./enums";
import type { EmailCandidate, EvidenceRef } from "./people";
import { organizations } from "./organizations";
import { people } from "./people";
import { trials } from "./trials";
import { tenants, users } from "./tenancy";

/**
 * A bounded contact-discovery run — real, persisted job state (this feature's
 * "reliability" requirement). One row per search (a signal's "Find relevant
 * contacts" action, or a free-text query). The actual research + extraction
 * runs after the request returns (see `after()` in the discover route) and
 * updates this row as it progresses, so the client can poll for partial
 * results / recovery instead of holding one long request open.
 */
export const discoveryJobs = pgTable(
  "discovery_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    queryText: text("query_text").notNull(),
    companyName: text("company_name"),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    signalId: uuid("signal_id").references(() => commercialSignals.id, { onDelete: "set null" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    trialId: uuid("trial_id").references(() => trials.id, { onDelete: "set null" }),
    useCase: text("use_case"),
    status: discoveryJobStatusEnum("status").notNull().default("queued"),
    /** Per-source coverage, e.g. { linkedin: "unavailable", companySite: "used" }. */
    coverage: jsonb("coverage").$type<Record<string, string>>().notNull().default({}),
    error: text("error"),
    researchRequestId: text("research_request_id"),
    extractionRequestId: text("extraction_request_id"),
    resultCount: integer("result_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_jobs_tenant_user_idx").on(t.tenantId, t.userId, t.createdAt),
    index("discovery_jobs_status_idx").on(t.status),
  ],
);

/**
 * One candidate person surfaced by a discovery job, BEFORE the user chooses to
 * save them. Kept server-side (not round-tripped through the client) so
 * "Add to tracker" reads back exactly what was validated during research
 * rather than trusting a resubmitted payload.
 */
export const discoveredContacts = pgTable(
  "discovered_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => discoveryJobs.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    company: text("company"),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    function: buyerFunctionEnum("function").notNull().default("other"),
    seniority: seniorityEnum("seniority").notNull().default("unknown"),
    professionalProfileUrl: text("professional_profile_url"),
    headshotUrl: text("headshot_url"),
    headshotSourceUrl: text("headshot_source_url"),
    description: text("description"),
    whyThisPerson: text("why_this_person"),
    whyNow: text("why_now"),
    relatedAssetId: uuid("related_asset_id").references(() => assets.id, { onDelete: "set null" }),
    relatedTrialId: uuid("related_trial_id").references(() => trials.id, { onDelete: "set null" }),
    relatedSignalId: uuid("related_signal_id").references(() => commercialSignals.id, { onDelete: "set null" }),
    useCase: text("use_case"),
    contactLabel: contactRelevanceLabelEnum("contact_label").notNull().default("potential_introducer"),
    relevanceScore: integer("relevance_score").notNull().default(0),
    relevanceBreakdown: jsonb("relevance_breakdown").$type<Record<string, number>>().notNull().default({}),
    sourceEvidence: jsonb("source_evidence").$type<EvidenceRef[]>().notNull().default([]),
    /** The resolved (or attempted) email for this candidate — same shape as a
     * `people.emailCandidates` entry, so saving copies it over verbatim. */
    emailResult: jsonb("email_result").$type<EmailCandidate | null>(),
    emailAddress: text("email_address"),
    emailProvenance: emailProvenanceEnum("email_provenance").notNull().default("not_found"),
    emailDeliverability: emailDeliverabilityEnum("email_deliverability").notNull().default("not_checked"),
    /** Set once the user clicks "Add to tracker" — points at the resulting
     * (possibly pre-existing, deduplicated) person row. */
    savedPersonId: uuid("saved_person_id").references(() => people.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovered_contacts_job_idx").on(t.jobId),
    index("discovered_contacts_tenant_idx").on(t.tenantId),
  ],
);
