CREATE TYPE "public"."contact_relevance_label" AS ENUM('direct_program_evidence', 'relevant_function_unconfirmed', 'potential_introducer');--> statement-breakpoint
CREATE TYPE "public"."discovery_job_status" AS ENUM('queued', 'running', 'partial', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_deliverability" AS ENUM('not_checked', 'verified', 'undeliverable', 'unknown_catch_all');--> statement-breakpoint
CREATE TYPE "public"."email_provenance" AS ENUM('publicly_sourced', 'inferred_pattern', 'user_supplied', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('new', 'researching', 'ready_to_contact', 'contacted', 'follow_up_due', 'replied', 'meeting_scheduled', 'qualified_opportunity', 'not_interested', 'do_not_contact');--> statement-breakpoint
CREATE TABLE "discovered_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"company" text,
	"organization_id" uuid,
	"function" "buyer_function" DEFAULT 'other' NOT NULL,
	"seniority" "seniority" DEFAULT 'unknown' NOT NULL,
	"professional_profile_url" text,
	"headshot_url" text,
	"headshot_source_url" text,
	"description" text,
	"why_this_person" text,
	"why_now" text,
	"related_asset_id" uuid,
	"related_trial_id" uuid,
	"related_signal_id" uuid,
	"use_case" text,
	"contact_label" "contact_relevance_label" DEFAULT 'potential_introducer' NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"relevance_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_result" jsonb,
	"email_address" text,
	"email_provenance" "email_provenance" DEFAULT 'not_found' NOT NULL,
	"email_deliverability" "email_deliverability" DEFAULT 'not_checked' NOT NULL,
	"saved_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"company_name" text,
	"organization_id" uuid,
	"signal_id" uuid,
	"asset_id" uuid,
	"trial_id" uuid,
	"use_case" text,
	"status" "discovery_job_status" DEFAULT 'queued' NOT NULL,
	"coverage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"research_request_id" text,
	"extraction_request_id" text,
	"result_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email_provenance" "email_provenance" DEFAULT 'not_found' NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email_deliverability" "email_deliverability" DEFAULT 'not_checked' NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email_pattern" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "email_candidates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "headshot_url" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "headshot_source_url" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "why_this_person" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "why_now" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "contact_label" "contact_relevance_label";--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "relevance_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "related_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "related_trial_id" uuid;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "related_signal_id" uuid;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "use_case" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "manual_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "pending_conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "outreach_status" "outreach_status" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "next_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_job_id_discovery_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."discovery_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_related_asset_id_assets_id_fk" FOREIGN KEY ("related_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_related_trial_id_trials_id_fk" FOREIGN KEY ("related_trial_id") REFERENCES "public"."trials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_related_signal_id_commercial_signals_id_fk" FOREIGN KEY ("related_signal_id") REFERENCES "public"."commercial_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_contacts" ADD CONSTRAINT "discovered_contacts_saved_person_id_people_id_fk" FOREIGN KEY ("saved_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_signal_id_commercial_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."commercial_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_jobs" ADD CONSTRAINT "discovery_jobs_trial_id_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."trials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovered_contacts_job_idx" ON "discovered_contacts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "discovered_contacts_tenant_idx" ON "discovered_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "discovery_jobs_tenant_user_idx" ON "discovery_jobs" USING btree ("tenant_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "discovery_jobs_status_idx" ON "discovery_jobs" USING btree ("status");--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_related_asset_id_assets_id_fk" FOREIGN KEY ("related_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_related_trial_id_trials_id_fk" FOREIGN KEY ("related_trial_id") REFERENCES "public"."trials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_email2_idx" ON "people" USING btree ("email");--> statement-breakpoint
CREATE INDEX "people_profile_url_idx" ON "people" USING btree ("tenant_id","professional_profile_url");--> statement-breakpoint
CREATE INDEX "tasks_person_idx" ON "tasks" USING btree ("person_id");