CREATE TABLE "ask_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ask_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"scope" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_scope_window_start_pk" PRIMARY KEY("scope","window_start")
);
--> statement-breakpoint
ALTER TABLE "trials" ADD COLUMN "first_posted_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ask_conversations" ADD CONSTRAINT "ask_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_conversations" ADD CONSTRAINT "ask_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_conversation_id_ask_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ask_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_conversations_owner_idx" ON "ask_conversations" USING btree ("tenant_id","user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ask_messages_conversation_idx" ON "ask_messages" USING btree ("conversation_id","created_at");