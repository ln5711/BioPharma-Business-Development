import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { people } from "./people";
import { tenants, users } from "./tenancy";

/**
 * Editable outreach drafts, kept SEPARATE from logged (already-sent) outreach in
 * `interactions`. A draft is never "sent" — there is no provider integration.
 * Scoped to (tenantId, userId). `evidenceRefs` links the draft back to the
 * trial / signal / account it was grounded in.
 */
export const outreachDrafts = pgTable(
  "outreach_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("draft"), // draft | archived
    /** [{ kind: "trial"|"signal"|"account", id, label, url }] */
    evidenceRefs: jsonb("evidence_refs")
      .$type<{ kind: string; id: string; label: string; url: string }[]>()
      .notNull()
      .default([]),
    /** Whether the visible body was model-generated or hand-written. */
    generatedBy: text("generated_by").notNull().default("user"), // user | claude
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outreach_drafts_owner_idx").on(t.tenantId, t.userId, t.updatedAt)],
);
