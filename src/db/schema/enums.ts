import { pgEnum } from "drizzle-orm/pg-core";

// ─── Organizations ──────────────────────────────────────────────────────────
export const organizationTypeEnum = pgEnum("organization_type", [
  "pharma",
  "biotech",
  "diagnostics",
  "cro",
  "central_lab",
  "sequencing",
  "data_company",
  "academic",
  "other",
]);

export const accountTierEnum = pgEnum("account_tier", [
  "strategic",
  "priority",
  "standard",
  "watch",
  "excluded",
]);

// ─── Sources ────────────────────────────────────────────────────────────────
export const sourceTypeEnum = pgEnum("source_type", [
  "clinicaltrials_gov",
  "company_web",
  "press_release",
  "investor_relations",
  "pipeline_page",
  "leadership_page",
  "pubmed",
  "europepmc",
  "crossref",
  "fda",
  "sec_edgar",
  "conference",
  "manual",
]);

export const sourcePageCategoryEnum = pgEnum("source_page_category", [
  "homepage",
  "newsroom",
  "press_releases",
  "investor_relations",
  "pipeline",
  "rd",
  "oncology_pipeline",
  "leadership",
  "clinical_programs",
  "publications",
  "scientific_presentations",
  "sec_filings",
  "partnerships",
  "careers",
]);

export const sourceHealthEnum = pgEnum("source_health", [
  "healthy",
  "degraded",
  "failing",
  "disabled",
]);

// ─── Assets / clinical development ──────────────────────────────────────────
export const developmentStageEnum = pgEnum("development_stage", [
  "discovery",
  "preclinical",
  "phase_1",
  "phase_1_2",
  "phase_2",
  "phase_2_3",
  "phase_3",
  "filed",
  "approved",
  "discontinued",
  "unknown",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "active",
  "paused",
  "discontinued",
  "partnered_out",
  "acquired",
  "unknown",
]);

// ─── Trials ─────────────────────────────────────────────────────────────────
export const trialStatusEnum = pgEnum("trial_status", [
  "not_yet_recruiting",
  "recruiting",
  "enrolling_by_invitation",
  "active_not_recruiting",
  "suspended",
  "terminated",
  "completed",
  "withdrawn",
  "unknown",
]);

export const trialPhaseEnum = pgEnum("trial_phase", [
  "early_phase_1",
  "phase_1",
  "phase_1_2",
  "phase_2",
  "phase_2_3",
  "phase_3",
  "phase_4",
  "not_applicable",
  "unknown",
]);

export const changeSeverityEnum = pgEnum("change_severity", [
  "cosmetic",
  "minor",
  "meaningful",
  "high",
]);

// ─── Signals ────────────────────────────────────────────────────────────────
export const signalTypeEnum = pgEnum("signal_type", [
  "NEW_TRIAL",
  /**
   * A trial newwin only started tracking today — first posted on
   * ClinicalTrials.gov outside the "new trial" recency window (historical
   * import via search or a watchlist's first pass). NOT a newly announced
   * trial; excluded from "new / changed" feeds.
   */
  "TRIAL_MONITORING_STARTED",
  "TRIAL_PHASE_CHANGE",
  "TRIAL_STATUS_CHANGE",
  "TRIAL_ENROLLMENT_CHANGE",
  "NEW_TRIAL_COHORT",
  "NEW_COMBINATION_ARM",
  "NEW_INDICATION",
  "NEW_BIOMARKER_REQUIREMENT",
  "NEW_CT_DNA_ENDPOINT",
  "NEW_MRD_ENDPOINT",
  "NEW_RESISTANCE_ENDPOINT",
  "NEW_TRANSLATIONAL_ENDPOINT",
  "NEW_TRIAL_SITE",
  "TRIAL_EXPANSION",
  "TRIAL_TERMINATION",
  "CLINICAL_HOLD",
  "NEW_PUBLICATION",
  "NEW_PREPRINT",
  "NEW_CONFERENCE_ABSTRACT",
  "NEW_DATA_READOUT",
  "POSITIVE_DATA",
  "NEGATIVE_DATA",
  "NEW_ASSET",
  "ASSET_DISCONTINUED",
  "PIPELINE_PRIORITIZATION",
  "LICENSING_DEAL",
  "PARTNERSHIP",
  "DIAGNOSTIC_PARTNERSHIP",
  "M_AND_A",
  "FINANCING",
  "FDA_SUBMISSION",
  "FDA_ACCEPTANCE",
  "FDA_APPROVAL",
  "LABEL_EXPANSION",
  "REGULATORY_SETBACK",
  "NEW_EXECUTIVE",
  "EXECUTIVE_DEPARTURE",
  "RESTRUCTURING",
  "NEW_JOB_POSTING",
  "CRM_RELATIONSHIP_STALE",
  "CONTACT_JOB_CHANGE",
  "CONTACT_RESPONDED",
  "CONTACT_NO_RESPONSE",
  "MEETING_REQUIRED",
  "CONFERENCE_OPPORTUNITY",
]);

export const signalCategoryEnum = pgEnum("signal_category", [
  "clinical_trial",
  "publication",
  "regulatory",
  "corporate",
  "leadership",
  "conference",
  "partnership",
  "relationship",
  "crm",
]);

export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high", "critical"]);

export const signalStatusEnum = pgEnum("signal_status", [
  "new",
  "reviewed",
  "actioned",
  "dismissed",
  "snoozed",
]);

// ─── Commercial timing (spec §70) ──────────────────────────────────────────
export const commercialTimingEnum = pgEnum("commercial_timing", [
  "too_early",
  "early",
  "ideal",
  "late",
  "maintenance",
  "closed",
]);

// ─── Opportunities ─────────────────────────────────────────────────────────
export const opportunityStageEnum = pgEnum("opportunity_stage", [
  "identified",
  "researching",
  "outreach",
  "engaged",
  "meeting",
  "qualified",
  "proposal",
  "won",
  "lost",
  "paused",
]);

export const commercialUseCaseEnum = pgEnum("commercial_use_case", [
  "patient_screening",
  "molecular_eligibility",
  "patient_selection",
  "companion_diagnostics",
  "clinical_trial_assay",
  "central_lab_testing",
  "baseline_genomic_characterization",
  "longitudinal_ctdna",
  "treatment_response_monitoring",
  "molecular_resistance_monitoring",
  "mrd",
  "recurrence_surveillance",
  "exploratory_biomarker",
  "retrospective_biomarker_analysis",
  "prospective_biomarker_support",
  "wes_wts",
  "tissue_plasma_concordance",
  "urine_testing",
  "methylation",
  "tumor_fraction",
  "pharmacodynamic_biomarker",
]);

// ─── People / relationships ────────────────────────────────────────────────
export const seniorityEnum = pgEnum("seniority", [
  "c_suite",
  "svp",
  "vp",
  "head",
  "director",
  "senior_manager",
  "manager",
  "scientist",
  "individual_contributor",
  "unknown",
]);

export const buyerFunctionEnum = pgEnum("buyer_function", [
  "translational_medicine",
  "precision_medicine",
  "biomarker_development",
  "companion_diagnostics",
  "clinical_development",
  "clinical_operations",
  "medical_affairs",
  "business_development",
  "external_innovation",
  "alliance_management",
  "corporate_development",
  "program_leadership",
  "executive",
  "other",
]);

export const relationshipHealthEnum = pgEnum("relationship_health", [
  "none",
  "cold_outreach",
  "engaged",
  "warm",
  "meeting_held",
  "opportunity_active",
  "dormant",
  "customer",
  "partner",
  "closed_lost",
  "do_not_contact",
]);

export const interactionTypeEnum = pgEnum("interaction_type", [
  "email_sent",
  "email_received",
  "linkedin_manual",
  "call",
  "meeting",
  "conference_meeting",
  "note",
  "introduction",
  "proposal",
  "nda",
  "quote",
  "opportunity_update",
]);

// ─── Evidence classification (spec §56) ────────────────────────────────────
export const claimKindEnum = pgEnum("claim_kind", [
  "fact",
  "inference",
  "recommendation",
]);

// ─── Watchlists ────────────────────────────────────────────────────────────
export const watchlistEntityKindEnum = pgEnum("watchlist_entity_kind", [
  "organization",
  "asset",
  "target",
  "pathway",
  "indication",
  "trial",
  "person",
  "keyword",
]);

// ─── Partner / competitor intelligence (spec §44) ─────────────────────────
export const partnerStatusEnum = pgEnum("partner_status", [
  "confirmed",
  "likely",
  "historical",
  "unknown",
]);

export const partnerScopeEnum = pgEnum("partner_scope", [
  "exclusive_looking",
  "potentially_complementary",
  "trial_specific",
  "asset_specific",
  "legacy",
  "unknown_scope",
]);

// ─── Tasks (BD workday — next-best-action families, spec §72) ──────────────
export const taskCategoryEnum = pgEnum("task_category", [
  "outreach",
  "research",
  "follow_up",
  "meeting_prep",
  "admin",
]);
