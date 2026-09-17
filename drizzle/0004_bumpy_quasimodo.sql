ALTER TABLE "tasks" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_interaction_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_related_organization_id_organizations_id_fk" FOREIGN KEY ("related_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_dedupe_idx" ON "tasks" USING btree ("tenant_id","dedupe_key");