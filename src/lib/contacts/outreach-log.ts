import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  capabilityProfiles,
  interactions,
  organizations,
  people,
  relationships,
  tasks,
} from "@/db/schema";
import { anthropic } from "@/lib/llm";

type Db = Awaited<ReturnType<typeof getDb>>;

export const CHANNEL_TO_TYPE = {
  email: "email_sent",
  linkedin: "linkedin_manual",
  call: "call",
  meeting: "meeting",
  conference: "conference_meeting",
  note: "note",
} as const;
export type Channel = keyof typeof CHANNEL_TO_TYPE;

/** Channels that represent a real outbound (or otherwise substantive) touch —
 * these advance `lastContactedAt` / outreach status. A `note` never does. */
const SUBSTANTIVE: ReadonlySet<Channel> = new Set(["email", "linkedin", "call", "meeting", "conference"]);

export interface LogOutreachInput {
  tenantId: string;
  userId: string;
  personId: string;
  channel: Channel;
  subject?: string | null;
  body?: string | null;
  direction?: "outbound" | "inbound" | null;
  outcome?: string | null;
  nextStep?: string | null;
  followUpDate?: string | null; // yyyy-mm-dd
}

export interface LogOutreachResult {
  interactionId: string;
  deduped: boolean;
  blocked?: string;
}

/**
 * Fixed logOutreach behaviour (spec §6):
 *  - resolves the contact/account by a VALIDATED personId, never fuzzy text
 *  - writes the correct interaction type (incl. linkedin_manual)
 *  - updates ONLY that person's relationship row
 *  - never advances lastContactedAt for a note
 *  - respects Do Not Contact for outbound touches (a note is still allowed)
 *  - is idempotent against an immediate duplicate resubmission
 *  - creates/updates ONE real follow-up task per person (never duplicates it)
 */
export async function logOutreachActivity(input: LogOutreachInput): Promise<LogOutreachResult> {
  const db = await getDb();

  const [person] = await db
    .select({ id: people.id, organizationId: people.organizationId, tenantId: people.tenantId })
    .from(people)
    .where(and(eq(people.id, input.personId), eq(people.tenantId, input.tenantId)))
    .limit(1);
  if (!person) throw new Error("Contact not found in this workspace.");

  const [rel] = await db
    .select()
    .from(relationships)
    .where(and(eq(relationships.tenantId, input.tenantId), eq(relationships.personId, person.id)))
    .limit(1);

  const isSubstantive = SUBSTANTIVE.has(input.channel);
  if (isSubstantive && rel?.outreachStatus === "do_not_contact") {
    return { interactionId: "", deduped: false, blocked: "This contact is marked Do Not Contact." };
  }

  // Idempotency: an identical (type, subject, body) logged in the last 15s for
  // this SAME person is treated as a resubmission, not a new event.
  const recentCutoff = new Date(Date.now() - 15_000);
  const [dupe] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(
      and(
        eq(interactions.tenantId, input.tenantId),
        eq(interactions.personId, person.id),
        eq(interactions.type, CHANNEL_TO_TYPE[input.channel]),
        gte(interactions.occurredAt, recentCutoff),
      ),
    )
    .orderBy(desc(interactions.occurredAt))
    .limit(1);
  if (dupe) {
    // Only short-circuit on an EXACT recent repeat (same subject+body); a
    // different message within the window is a real second event.
    const [full] = await db.select().from(interactions).where(eq(interactions.id, dupe.id)).limit(1);
    if (full && (full.subject ?? "") === (input.subject ?? "") && (full.body ?? "") === (input.body ?? "")) {
      await maybeCreateFollowUp(db, input, person.organizationId);
      return { interactionId: full.id, deduped: true };
    }
  }

  const outcomeText = [input.direction, input.outcome].filter(Boolean).join(" · ") || (isSubstantive ? "logged" : null);

  const [row] = await db
    .insert(interactions)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      personId: person.id,
      organizationId: person.organizationId,
      type: CHANNEL_TO_TYPE[input.channel],
      subject: input.subject || null,
      body: input.body || null,
      outcome: outcomeText,
      nextStep: input.nextStep || null,
      crmSyncStatus: "not_synced",
    })
    .returning({ id: interactions.id });

  if (isSubstantive) {
    const nextStatus = input.followUpDate ? "follow_up_due" : nextOutreachStatus(rel?.outreachStatus);
    const now = new Date();
    if (rel) {
      await db
        .update(relationships)
        .set({
          lastContactedAt: now,
          firstContactedAt: rel.firstContactedAt ?? now,
          outreachStatus: nextStatus as never,
          updatedAt: now,
        })
        .where(eq(relationships.id, rel.id));
    } else {
      await db.insert(relationships).values({
        tenantId: input.tenantId,
        personId: person.id,
        organizationId: person.organizationId,
        ownerUserId: input.userId,
        lastContactedAt: now,
        firstContactedAt: now,
        outreachStatus: nextStatus as never,
      });
    }
  }

  await maybeCreateFollowUp(db, input, person.organizationId);

  return { interactionId: row.id, deduped: false };
}

function nextOutreachStatus(current: string | undefined): string {
  const ADVANCED = new Set(["replied", "meeting_scheduled", "qualified_opportunity", "not_interested", "do_not_contact"]);
  if (current && ADVANCED.has(current)) return current; // never regress a further-along status
  return "contacted";
}

async function maybeCreateFollowUp(db: Db, input: LogOutreachInput, organizationId: string | null) {
  if (!input.followUpDate) return;
  const dueAt = new Date(`${input.followUpDate}T09:00:00Z`);
  if (Number.isNaN(dueAt.getTime())) return;
  const dedupeKey = `outreach_followup:${input.personId}`;
  await db
    .insert(tasks)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      title: "Follow up on outreach",
      category: "follow_up",
      notes: input.nextStep || null,
      dueAt,
      relatedOrganizationId: organizationId,
      personId: input.personId,
      source: "outreach_followup",
      dedupeKey,
    })
    .onConflictDoUpdate({
      target: [tasks.tenantId, tasks.dedupeKey],
      set: { dueAt, notes: input.nextStep || null, done: false, completedAt: null },
    });
}

/**
 * Grounded, editable draft — never invents capabilities, relationships, or
 * program needs beyond what's on record (spec §6).
 */
export async function generateOutreachDraft(params: {
  tenantId: string;
  userId: string;
  personId: string;
}): Promise<{ subject: string; body: string; generatedBy: "claude" | "user" }> {
  const db = await getDb();
  const [person] = await db.select().from(people).where(and(eq(people.id, params.personId), eq(people.tenantId, params.tenantId))).limit(1);
  if (!person) throw new Error("Contact not found in this workspace.");
  const [org] = person.organizationId
    ? await db.select({ name: organizations.canonicalName }).from(organizations).where(eq(organizations.id, person.organizationId)).limit(1)
    : [undefined];
  const [capability] = await db.select().from(capabilityProfiles).where(eq(capabilityProfiles.tenantId, params.tenantId)).limit(1);

  const client = anthropic();
  const fallback = {
    subject: `Introduction — ${capability?.companyName ?? "our team"} <> ${org?.name ?? person.name}`,
    body:
      `Hi ${person.name.split(" ")[0]},\n\n` +
      `I wanted to reach out given your work${person.title ? ` as ${person.title}` : ""}${org?.name ? ` at ${org.name}` : ""}. ` +
      `${person.whyThisPerson ?? ""}\n\n` +
      `Would you be open to a short call to discuss whether there's a fit?\n\nBest,\n`,
    generatedBy: "user" as const,
  };
  if (!client) return fallback;

  try {
    const rich = await client.generateTextRich({
      system:
        "Draft a SHORT, professional outreach email (subject + body) for oncology business development. " +
        "Ground every claim ONLY in the facts given — the person's evidenced role, the named signal/program, " +
        "and the sender's OWN configured capabilities. Never invent assay capabilities, prior relationships, " +
        "or a program need that isn't stated. Plain prose, no markdown. End with 'SUBJECT: <line>' on its own " +
        "line at the very end containing just the subject (the rest is the body, before that line).",
      prompt: JSON.stringify({
        recipient: { name: person.name, title: person.title, function: person.function, whyThisPerson: person.whyThisPerson, whyNow: person.whyNow, company: org?.name },
        senderCapabilities: capability
          ? {
              company: capability.companyName,
              testingModalities: capability.testingModalities,
              sampleTypes: capability.sampleTypes,
              technologies: capability.technologies,
              biomarkersCovered: capability.biomarkersCovered,
              cancerTypes: capability.cancerTypes,
            }
          : null,
      }),
      maxTokens: 500,
      temperature: 0.4,
      timeoutMs: 20_000,
    });
    const m = /\nSUBJECT:\s*(.+)\s*$/i.exec(rich.text.trim());
    const subject = m?.[1]?.trim() || fallback.subject;
    const body = (m ? rich.text.slice(0, m.index) : rich.text).trim();
    if (body.length < 20) return fallback;
    return { subject, body, generatedBy: "claude" };
  } catch {
    return fallback;
  }
}
