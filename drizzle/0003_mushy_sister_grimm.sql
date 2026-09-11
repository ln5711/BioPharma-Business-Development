ALTER TABLE "user_preferences" ADD COLUMN "theme" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessions_revoked_at" timestamp with time zone;