CREATE TYPE "public"."account_tier" AS ENUM('strategic', 'priority', 'standard', 'watch', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'paused', 'discontinued', 'partnered_out', 'acquired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."buyer_function" AS ENUM('translational_medicine', 'precision_medicine', 'biomarker_development', 'companion_diagnostics', 'clinical_development', 'clinical_operations', 'medical_affairs', 'business_development', 'external_innovation', 'alliance_management', 'corporate_development', 'program_leadership', 'executive', 'other');--> statement-breakpoint
CREATE TYPE "public"."change_severity" AS ENUM('cosmetic', 'minor', 'meaningful', 'high');--> statement-breakpoint
CREATE TYPE "public"."claim_kind" AS ENUM('fact', 'inference', 'recommendation');--> statement-breakpoint
CREATE TYPE "public"."commercial_timing" AS ENUM('too_early', 'early', 'ideal', 'late', 'maintenance', 'closed');--> statement-breakpoint
CREATE TYPE "public"."commercial_use_case" AS ENUM('patient_screening', 'molecular_eligibility', 'patient_selection', 'companion_diagnostics', 'clinical_trial_assay', 'central_lab_testing', 'baseline_genomic_characterization', 'longitudinal_ctdna', 'treatment_response_monitoring', 'molecular_resistance_monitoring', 'mrd', 'recurrence_surveillance', 'exploratory_biomarker', 'retrospective_biomarker_analysis', 'prospective_biomarker_support', 'wes_wts', 'tissue_plasma_concordance', 'urine_testing', 'methylation', 'tumor_fraction', 'pharmacodynamic_biomarker');--> statement-breakpoint
CREATE TYPE "public"."development_stage" AS ENUM('discovery', 'preclinical', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'filed', 'approved', 'discontinued', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('email_sent', 'email_received', 'linkedin_manual', 'call', 'meeting', 'conference_meeting', 'note', 'introduction', 'proposal', 'nda', 'quote', 'opportunity_update');--> statement-breakpoint
CREATE TYPE "public"."opportunity_stage" AS ENUM('identified', 'researching', 'outreach', 'engaged', 'meeting', 'qualified', 'proposal', 'won', 'lost', 'paused');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('pharma', 'biotech', 'diagnostics', 'cro', 'central_lab', 'sequencing', 'data_company', 'academic', 'other');--> statement-breakpoint
CREATE TYPE "public"."partner_scope" AS ENUM('exclusive_looking', 'potentially_complementary', 'trial_specific', 'asset_specific', 'legacy', 'unknown_scope');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('confirmed', 'likely', 'historical', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."relationship_health" AS ENUM('none', 'cold_outreach', 'engaged', 'warm', 'meeting_held', 'opportunity_active', 'dormant', 'customer', 'partner', 'closed_lost', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."seniority" AS ENUM('c_suite', 'svp', 'vp', 'head', 'director', 'senior_manager', 'manager', 'scientist', 'individual_contributor', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."signal_category" AS ENUM('clinical_trial', 'publication', 'regulatory', 'corporate', 'leadership', 'conference', 'partnership', 'relationship', 'crm');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('new', 'reviewed', 'actioned', 'dismissed', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('NEW_TRIAL', 'TRIAL_PHASE_CHANGE', 'TRIAL_STATUS_CHANGE', 'TRIAL_ENROLLMENT_CHANGE', 'NEW_TRIAL_COHORT', 'NEW_COMBINATION_ARM', 'NEW_INDICATION', 'NEW_BIOMARKER_REQUIREMENT', 'NEW_CT_DNA_ENDPOINT', 'NEW_MRD_ENDPOINT', 'NEW_RESISTANCE_ENDPOINT', 'NEW_TRANSLATIONAL_ENDPOINT', 'NEW_TRIAL_SITE', 'TRIAL_EXPANSION', 'TRIAL_TERMINATION', 'CLINICAL_HOLD', 'NEW_PUBLICATION', 'NEW_PREPRINT', 'NEW_CONFERENCE_ABSTRACT', 'NEW_DATA_READOUT', 'POSITIVE_DATA', 'NEGATIVE_DATA', 'NEW_ASSET', 'ASSET_DISCONTINUED', 'PIPELINE_PRIORITIZATION', 'LICENSING_DEAL', 'PARTNERSHIP', 'DIAGNOSTIC_PARTNERSHIP', 'M_AND_A', 'FINANCING', 'FDA_SUBMISSION', 'FDA_ACCEPTANCE', 'FDA_APPROVAL', 'LABEL_EXPANSION', 'REGULATORY_SETBACK', 'NEW_EXECUTIVE', 'EXECUTIVE_DEPARTURE', 'RESTRUCTURING', 'NEW_JOB_POSTING', 'CRM_RELATIONSHIP_STALE', 'CONTACT_JOB_CHANGE', 'CONTACT_RESPONDED', 'CONTACT_NO_RESPONSE', 'MEETING_REQUIRED', 'CONFERENCE_OPPORTUNITY');--> statement-breakpoint
CREATE TYPE "public"."source_health" AS ENUM('healthy', 'degraded', 'failing', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."source_page_category" AS ENUM('homepage', 'newsroom', 'press_releases', 'investor_relations', 'pipeline', 'rd', 'oncology_pipeline', 'leadership', 'clinical_programs', 'publications', 'scientific_presentations', 'sec_filings', 'partnerships', 'careers');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('clinicaltrials_gov', 'company_web', 'press_release', 'investor_relations', 'pipeline_page', 'leadership_page', 'pubmed', 'europepmc', 'crossref', 'fda', 'sec_edgar', 'conference', 'manual');--> statement-breakpoint
CREATE TYPE "public"."trial_phase" AS ENUM('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4', 'not_applicable', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."trial_status" AS ENUM('not_yet_recruiting', 'recruiting', 'enrolling_by_invitation', 'active_not_recruiting', 'suspended', 'terminated', 'completed', 'withdrawn', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."watchlist_entity_kind" AS ENUM('organization', 'asset', 'target', 'pathway', 'indication', 'trial', 'person', 'keyword');--> statement-breakpoint
CREATE TABLE "ai_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"correction_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"website" text,
	"description" text,
	"products_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"testing_modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"genes_covered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"biomarkers_covered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancer_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clinical_stages_supported" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geographies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regulatory_status" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capability_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"must_pursue" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"desirable" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitive_conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_indications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_pathways" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_account_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trial_stages_of_interest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minimum_opportunity_score" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"weights" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"function" text NOT NULL,
	"strength" text DEFAULT 'none' NOT NULL,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL,
	"kind" text DEFAULT 'name' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"partner_name" text NOT NULL,
	"partner_type" text NOT NULL,
	"asset_id" uuid,
	"status" text DEFAULT 'unknown' NOT NULL,
	"scope" text DEFAULT 'unknown_scope' NOT NULL,
	"evidence_url" text,
	"evidence_excerpt" text,
	"announced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_type" "source_type" DEFAULT 'company_web' NOT NULL,
	"page_category" "source_page_category" DEFAULT 'newsroom' NOT NULL,
	"url" text NOT NULL,
	"feed_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"crawl_frequency_minutes" integer DEFAULT 1440 NOT NULL,
	"robots_allowed" boolean DEFAULT true NOT NULL,
	"parser" text DEFAULT 'generic_html' NOT NULL,
	"reliability_score" integer DEFAULT 70 NOT NULL,
	"etag" text,
	"content_hash" text,
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_http_status" integer,
	"health" "source_health" DEFAULT 'healthy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"organization_type" "organization_type" DEFAULT 'biotech' NOT NULL,
	"parent_company_id" uuid,
	"website" text,
	"canonical_domain" text,
	"headquarters" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"ticker" text,
	"cik" text,
	"description" text,
	"employee_estimate" integer,
	"oncology_focus" boolean DEFAULT true NOT NULL,
	"account_tier" "account_tier" DEFAULT 'standard' NOT NULL,
	"account_score" integer,
	"owner_user_id" uuid,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biomarkers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"target_gene" text,
	"alteration" text,
	"assay_type" text,
	"specimen_type" text,
	"clinical_role" text
);
--> statement-breakpoint
CREATE TABLE "disease_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disease_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diseases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"oncotree_code" text,
	"icd_code" text,
	"category" text DEFAULT 'solid' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pathways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_targets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gene" text NOT NULL,
	"protein" text,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alterations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pathway_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL,
	"kind" text DEFAULT 'development_code' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_indications" (
	"asset_id" uuid NOT NULL,
	"disease_id" uuid NOT NULL,
	CONSTRAINT "asset_indications_asset_id_disease_id_pk" PRIMARY KEY("asset_id","disease_id")
);
--> statement-breakpoint
CREATE TABLE "asset_pathways" (
	"asset_id" uuid NOT NULL,
	"pathway_id" uuid NOT NULL,
	CONSTRAINT "asset_pathways_asset_id_pathway_id_pk" PRIMARY KEY("asset_id","pathway_id")
);
--> statement-breakpoint
CREATE TABLE "asset_targets" (
	"asset_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "asset_targets_asset_id_target_id_pk" PRIMARY KEY("asset_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"development_code" text,
	"brand_name" text,
	"modality" text,
	"mechanism_of_action" text,
	"stage" "development_stage" DEFAULT 'unknown' NOT NULL,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"licensed_from" text,
	"licensed_to" text,
	"partner_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_assets" (
	"trial_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"match_confidence" integer DEFAULT 60 NOT NULL,
	"match_evidence" text,
	CONSTRAINT "trial_assets_trial_id_asset_id_pk" PRIMARY KEY("trial_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "trial_biomarkers" (
	"trial_id" uuid NOT NULL,
	"biomarker_id" uuid NOT NULL,
	"role" text,
	CONSTRAINT "trial_biomarkers_trial_id_biomarker_id_pk" PRIMARY KEY("trial_id","biomarker_id")
);
--> statement-breakpoint
CREATE TABLE "trial_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trial_id" uuid NOT NULL,
	"nct_id" text NOT NULL,
	"from_snapshot_id" uuid,
	"to_snapshot_id" uuid,
	"field_changed" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"severity" "change_severity" DEFAULT 'minor' NOT NULL,
	"commercial_relevance" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_timestamp" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trial_conditions" (
	"trial_id" uuid NOT NULL,
	"disease_id" uuid NOT NULL,
	CONSTRAINT "trial_conditions_trial_id_disease_id_pk" PRIMARY KEY("trial_id","disease_id")
);
--> statement-breakpoint
CREATE TABLE "trial_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_id" uuid NOT NULL,
	"nct_id" text NOT NULL,
	"record_version_hash" text NOT NULL,
	"ctgov_last_update" timestamp with time zone,
	"payload" jsonb NOT NULL,
	"raw_payload" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nct_id" text NOT NULL,
	"title" text,
	"official_title" text,
	"sponsor_name" text,
	"sponsor_organization_id" uuid,
	"collaborators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase" "trial_phase" DEFAULT 'unknown' NOT NULL,
	"status" "trial_status" DEFAULT 'unknown' NOT NULL,
	"study_type" text,
	"enrollment" integer,
	"enrollment_type" text,
	"conditions_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interventions_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"arms_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"location_count" integer,
	"locations_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eligibility_text" text,
	"primary_endpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secondary_endpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exploratory_endpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_date" timestamp with time zone,
	"primary_completion_date" timestamp with time zone,
	"completion_date" timestamp with time zone,
	"last_ctgov_update" timestamp with time zone,
	"molecular_eligibility" boolean DEFAULT false NOT NULL,
	"biomarker_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ctdna_mentions" boolean DEFAULT false NOT NULL,
	"mrd_mentions" boolean DEFAULT false NOT NULL,
	"ngs_mentions" boolean DEFAULT false NOT NULL,
	"resistance_monitoring_mentions" boolean DEFAULT false NOT NULL,
	"central_lab_mentions" boolean DEFAULT false NOT NULL,
	"biospecimen_retention" text,
	"serial_sampling_mentions" boolean DEFAULT false NOT NULL,
	"commercial_summary" text,
	"record_version_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "interaction_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"person_id" uuid,
	"organization_id" uuid,
	"asset_id" uuid,
	"signal_id" uuid,
	"campaign_id" uuid,
	"subject" text,
	"body" text,
	"response" text,
	"outcome" text,
	"next_step" text,
	"crm_sync_status" text DEFAULT 'not_synced' NOT NULL,
	"crm_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"department" text,
	"seniority" "seniority" DEFAULT 'unknown' NOT NULL,
	"function" "buyer_function" DEFAULT 'other' NOT NULL,
	"professional_profile_url" text,
	"public_email" text,
	"location" text,
	"relevance_score" integer,
	"source_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_asset_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"asset_id" uuid,
	"trial_id" uuid,
	"evidence_kind" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"url" text,
	"excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"organization_id" uuid,
	"owner_user_id" uuid,
	"health" "relationship_health" DEFAULT 'none' NOT NULL,
	"relationship_strength" integer DEFAULT 0 NOT NULL,
	"first_contacted_at" timestamp with time zone,
	"last_contacted_at" timestamp with time zone,
	"last_response_at" timestamp with time zone,
	"last_meeting_at" timestamp with time zone,
	"opted_out" text,
	"notes" text,
	"crm_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"signal_type" "signal_type" NOT NULL,
	"category" "signal_category" NOT NULL,
	"organization_id" uuid,
	"asset_id" uuid,
	"trial_id" uuid,
	"person_id" uuid,
	"trial_change_id" uuid,
	"headline" text NOT NULL,
	"fact_summary" text NOT NULL,
	"scientific_interpretation" text,
	"commercial_interpretation" text,
	"why_it_matters" text,
	"why_now" text,
	"recommended_action" text,
	"recommended_personas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"urgency" "urgency" DEFAULT 'medium' NOT NULL,
	"opportunity_score" integer,
	"confidence_score" integer,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "signal_status" DEFAULT 'new' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_date" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"user_id" uuid,
	"verdict" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"source_type" "source_type" NOT NULL,
	"title" text,
	"url" text,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"excerpt" text,
	"claim_kind" "claim_kind" DEFAULT 'fact' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"asset_id" uuid,
	"trial_id" uuid,
	"origin_signal_id" uuid,
	"title" text NOT NULL,
	"indication" text,
	"commercial_use_case" "commercial_use_case",
	"is_prospective" text DEFAULT 'prospective' NOT NULL,
	"stage" "opportunity_stage" DEFAULT 'identified' NOT NULL,
	"timing" "commercial_timing" DEFAULT 'ideal' NOT NULL,
	"opportunity_score" integer DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"estimated_value" numeric,
	"probability" numeric,
	"why_now" text,
	"next_action" text,
	"next_action_date" timestamp with time zone,
	"competitor_status" text,
	"owner_user_id" uuid,
	"crm_opportunity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_score_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"scoring_profile_id" uuid,
	"commercial_fit" integer DEFAULT 0 NOT NULL,
	"clinical_timing" integer DEFAULT 0 NOT NULL,
	"biomarker_need" integer DEFAULT 0 NOT NULL,
	"relationship_accessibility" integer DEFAULT 0 NOT NULL,
	"signal_strength" integer DEFAULT 0 NOT NULL,
	"account_strategic_value" integer DEFAULT 0 NOT NULL,
	"urgency" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"rationale" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"job_name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "source_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"authority_level" text DEFAULT 'primary' NOT NULL,
	"access_method" text DEFAULT 'api' NOT NULL,
	"url" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"update_frequency_minutes" integer DEFAULT 1440 NOT NULL,
	"reliability_score" integer DEFAULT 90 NOT NULL,
	"robots_allowed" text DEFAULT 'allowed' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_change_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"health" "source_health" DEFAULT 'healthy' NOT NULL,
	"signals_produced" integer DEFAULT 0 NOT NULL,
	"opportunities_produced" integer DEFAULT 0 NOT NULL,
	"meetings_produced" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"entity_kind" "watchlist_entity_kind" NOT NULL,
	"entity_id" uuid,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_user_id" uuid,
	"min_opportunity_score" integer DEFAULT 50 NOT NULL,
	"alert_mode" text DEFAULT 'daily_digest' NOT NULL,
	"ctgov_query" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_profiles" ADD CONSTRAINT "capability_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_profiles" ADD CONSTRAINT "scoring_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_coverage" ADD CONSTRAINT "account_coverage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_coverage" ADD CONSTRAINT "account_coverage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_aliases" ADD CONSTRAINT "organization_aliases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_partners" ADD CONSTRAINT "organization_partners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_partners" ADD CONSTRAINT "organization_partners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sources" ADD CONSTRAINT "organization_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disease_aliases" ADD CONSTRAINT "disease_aliases_disease_id_diseases_id_fk" FOREIGN KEY ("disease_id") REFERENCES "public"."diseases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_aliases" ADD CONSTRAINT "asset_aliases_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_indications" ADD CONSTRAINT "asset_indications_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_indications" ADD CONSTRAINT "asset_indications_disease_id_diseases_id_fk" FOREIGN KEY ("disease_id") REFERENCES "public"."diseases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_pathways" ADD CONSTRAINT "asset_pathways_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_pathways" ADD CONSTRAINT "asset_pathways_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "public"."pathways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_targets" ADD CONSTRAINT "asset_targets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_targets" ADD CONSTRAINT "asset_targets_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_assets" ADD CONSTRAINT "trial_assets_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_assets" ADD CONSTRAINT "trial_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_biomarkers" ADD CONSTRAINT "trial_biomarkers_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_biomarkers" ADD CONSTRAINT "trial_biomarkers_biomarker_id_biomarkers_id_fk" FOREIGN KEY ("biomarker_id") REFERENCES "public"."biomarkers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_changes" ADD CONSTRAINT "trial_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_changes" ADD CONSTRAINT "trial_changes_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_changes" ADD CONSTRAINT "trial_changes_from_snapshot_id_trial_snapshots_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."trial_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_changes" ADD CONSTRAINT "trial_changes_to_snapshot_id_trial_snapshots_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."trial_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_conditions" ADD CONSTRAINT "trial_conditions_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_conditions" ADD CONSTRAINT "trial_conditions_disease_id_diseases_id_fk" FOREIGN KEY ("disease_id") REFERENCES "public"."diseases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_snapshots" ADD CONSTRAINT "trial_snapshots_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_sponsor_organization_id_organizations_id_fk" FOREIGN KEY ("sponsor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_asset_evidence" ADD CONSTRAINT "person_asset_evidence_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_asset_evidence" ADD CONSTRAINT "person_asset_evidence_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_asset_evidence" ADD CONSTRAINT "person_asset_evidence_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_trial_change_id_trial_changes_id_fk" FOREIGN KEY ("trial_change_id") REFERENCES "public"."trial_changes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_signals" ADD CONSTRAINT "commercial_signals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_feedback" ADD CONSTRAINT "signal_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_feedback" ADD CONSTRAINT "signal_feedback_signal_id_commercial_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."commercial_signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_feedback" ADD CONSTRAINT "signal_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_sources" ADD CONSTRAINT "signal_sources_signal_id_commercial_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."commercial_signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_origin_signal_id_commercial_signals_id_fk" FOREIGN KEY ("origin_signal_id") REFERENCES "public"."commercial_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_score_components" ADD CONSTRAINT "opportunity_score_components_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_registry" ADD CONSTRAINT "source_registry_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_coverage_org_fn_idx" ON "account_coverage" USING btree ("organization_id","function");--> statement-breakpoint
CREATE INDEX "organization_aliases_org_idx" ON "organization_aliases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_aliases_normalized_idx" ON "organization_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "organization_partners_org_idx" ON "organization_partners" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_sources_org_idx" ON "organization_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_sources_url_idx" ON "organization_sources" USING btree ("organization_id","url");--> statement-breakpoint
CREATE INDEX "organization_sources_enabled_idx" ON "organization_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "organizations_tenant_idx" ON "organizations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_tenant_name_idx" ON "organizations" USING btree ("tenant_id","canonical_name");--> statement-breakpoint
CREATE INDEX "organizations_domain_idx" ON "organizations" USING btree ("canonical_domain");--> statement-breakpoint
CREATE INDEX "organizations_ticker_idx" ON "organizations" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "biomarkers_name_idx" ON "biomarkers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "disease_aliases_normalized_idx" ON "disease_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "diseases_name_idx" ON "diseases" USING btree ("canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "pathways_name_idx" ON "pathways" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "targets_gene_idx" ON "targets" USING btree ("gene");--> statement-breakpoint
CREATE INDEX "asset_aliases_asset_idx" ON "asset_aliases" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_aliases_normalized_idx" ON "asset_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "assets_tenant_idx" ON "assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_tenant_name_idx" ON "assets" USING btree ("tenant_id","organization_id","canonical_name");--> statement-breakpoint
CREATE INDEX "assets_dev_code_idx" ON "assets" USING btree ("development_code");--> statement-breakpoint
CREATE INDEX "trial_changes_tenant_idx" ON "trial_changes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "trial_changes_trial_idx" ON "trial_changes" USING btree ("trial_id");--> statement-breakpoint
CREATE INDEX "trial_changes_detected_idx" ON "trial_changes" USING btree ("detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_changes_dedupe_idx" ON "trial_changes" USING btree ("trial_id","field_changed","to_snapshot_id");--> statement-breakpoint
CREATE INDEX "trial_snapshots_trial_idx" ON "trial_snapshots" USING btree ("trial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_snapshots_trial_hash_idx" ON "trial_snapshots" USING btree ("trial_id","record_version_hash");--> statement-breakpoint
CREATE INDEX "trial_snapshots_captured_idx" ON "trial_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "trials_tenant_idx" ON "trials" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trials_tenant_nct_idx" ON "trials" USING btree ("tenant_id","nct_id");--> statement-breakpoint
CREATE INDEX "trials_nct_idx" ON "trials" USING btree ("nct_id");--> statement-breakpoint
CREATE INDEX "trials_sponsor_org_idx" ON "trials" USING btree ("sponsor_organization_id");--> statement-breakpoint
CREATE INDEX "trials_status_idx" ON "trials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trials_phase_idx" ON "trials" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "trials_hash_idx" ON "trials" USING btree ("record_version_hash");--> statement-breakpoint
CREATE INDEX "interactions_tenant_idx" ON "interactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "interactions_person_idx" ON "interactions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "interactions_org_idx" ON "interactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "interactions_occurred_idx" ON "interactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "people_tenant_idx" ON "people" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_org_idx" ON "people" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "people_email_idx" ON "people" USING btree ("public_email");--> statement-breakpoint
CREATE INDEX "people_function_idx" ON "people" USING btree ("function");--> statement-breakpoint
CREATE INDEX "person_asset_evidence_person_idx" ON "person_asset_evidence" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_asset_evidence_asset_idx" ON "person_asset_evidence" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_tenant_person_idx" ON "relationships" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "relationships_org_idx" ON "relationships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "relationships_owner_idx" ON "relationships" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "commercial_signals_tenant_idx" ON "commercial_signals" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_signals_dedupe_idx" ON "commercial_signals" USING btree ("tenant_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "commercial_signals_org_idx" ON "commercial_signals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "commercial_signals_asset_idx" ON "commercial_signals" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "commercial_signals_trial_idx" ON "commercial_signals" USING btree ("trial_id");--> statement-breakpoint
CREATE INDEX "commercial_signals_detected_idx" ON "commercial_signals" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "commercial_signals_score_idx" ON "commercial_signals" USING btree ("opportunity_score");--> statement-breakpoint
CREATE INDEX "commercial_signals_status_idx" ON "commercial_signals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_feedback_unique_idx" ON "signal_feedback" USING btree ("signal_id","user_id","verdict");--> statement-breakpoint
CREATE INDEX "signal_sources_signal_idx" ON "signal_sources" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "opportunities_tenant_idx" ON "opportunities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "opportunities_org_idx" ON "opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunities_score_idx" ON "opportunities" USING btree ("opportunity_score");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunity_score_components_opp_idx" ON "opportunity_score_components" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "job_runs_name_idx" ON "job_runs" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "job_runs_started_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "source_registry_tenant_idx" ON "source_registry" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "source_registry_type_idx" ON "source_registry" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "source_registry_health_idx" ON "source_registry" USING btree ("health");--> statement-breakpoint
CREATE INDEX "watchlist_items_watchlist_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlist_items_kind_idx" ON "watchlist_items" USING btree ("entity_kind");--> statement-breakpoint
CREATE INDEX "watchlists_tenant_idx" ON "watchlists" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_tenant_name_idx" ON "watchlists" USING btree ("tenant_id","name");