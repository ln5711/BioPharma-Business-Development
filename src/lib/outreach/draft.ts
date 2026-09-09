import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  capabilityProfiles,
  commercialSignals,
  organizations,
  people,
  trials,
} from "@/db/schema";
import { anthropic } from "@/lib/llm";

export interface DraftContext {
  person: { id: string; name: string; title: string | null; email: string | null } | null;
  organization: { id: string; name: string } | null;
  trial: { nctId: string; title: string | null; phase: string; summary: string | null } | null;
  signal: { id: string; headline: string; factSummary: string } | null;
  capability: { companyName: string; description: string | null; strengths: string[] } | null;
  evidenceRefs: { kind: string; id: string; label: string; url: string }[];
}

/**
 * Assemble the AUTHORIZED context for a draft — person, account, trial, signal,
 * and the user's own capability profile — all tenant-scoped. IDs come from the
 * request, but every lookup is filtered by tenantId.
 */
export async function loadDraftContext(
  tenantId: string,
  input: { personId?: string; organizationId?: string; nctId?: string; signalId?: string },
): Promise<DraftContext> {
  const db = await getDb();
  const evidenceRefs: DraftContext["evidenceRefs"] = [];

  let person: DraftContext["person"] = null;
  let organization: DraftContext["organization"] = null;
  if (input.personId) {
    const [p] = await db
      .select({
        id: people.id,
        name: people.name,
        title: people.title,
        email: people.publicEmail,
        orgId: people.organizationId,
      })
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.tenantId, tenantId)))
      .limit(1);
    if (p) {
      person = { id: p.id, name: p.name, title: p.title, email: p.email };
      if (p.orgId) input.organizationId = input.organizationId ?? p.orgId;
    }
  }
  if (input.organizationId) {
    const [o] = await db
      .select({ id: organizations.id, name: organizations.canonicalName })
      .from(organizations)
      .where(and(eq(organizations.id, input.organizationId), eq(organizations.tenantId, tenantId)))
      .limit(1);
    if (o) {
      organization = o;
      evidenceRefs.push({ kind: "account", id: o.id, label: o.name, url: `/accounts/${o.id}` });
    }
  }

  let trial: DraftContext["trial"] = null;
  if (input.nctId) {
    const [t] = await db
      .select({
        nctId: trials.nctId,
        title: trials.title,
        phase: trials.phase,
        summary: trials.commercialSummary,
      })
      .from(trials)
      .where(and(eq(trials.nctId, input.nctId.toUpperCase()), eq(trials.tenantId, tenantId)))
      .limit(1);
    if (t) {
      trial = t;
      evidenceRefs.push({
        kind: "trial",
        id: t.nctId,
        label: `${t.nctId} — ${t.title ?? ""}`,
        url: `/trials/${t.nctId}`,
      });
    }
  }

  let signal: DraftContext["signal"] = null;
  if (input.signalId) {
    const [s] = await db
      .select({ id: commercialSignals.id, headline: commercialSignals.headline, fact: commercialSignals.factSummary })
      .from(commercialSignals)
      .where(and(eq(commercialSignals.id, input.signalId), eq(commercialSignals.tenantId, tenantId)))
      .limit(1);
    if (s) {
      signal = { id: s.id, headline: s.headline, factSummary: s.fact };
      evidenceRefs.push({
        kind: "signal",
        id: s.id,
        label: s.headline,
        url: `/intelligence?signal=${s.id}`,
      });
    }
  }

  const [cap] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.tenantId, tenantId))
    .limit(1);
  const capability = cap
    ? {
        companyName: cap.companyName,
        description: cap.description,
        strengths: [
          ...(cap.productsServices ?? []),
          ...(cap.testingModalities ?? []),
          ...(cap.technologies ?? []),
        ].slice(0, 12),
      }
    : null;

  return { person, organization, trial, signal, capability, evidenceRefs };
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  meta: { model: string | null; requestId: string | null };
}

/**
 * Claude-generated outreach draft grounded ONLY in the provided context. Returns
 * a deterministic template when no model is configured (clearly marked).
 */
export async function generateDraft(ctx: DraftContext): Promise<GeneratedDraft> {
  const client = anthropic();
  const recipient = ctx.person?.name ?? "there";
  const anchor =
    ctx.trial?.title ??
    ctx.signal?.headline ??
    (ctx.organization ? `recent developments at ${ctx.organization.name}` : "your work");

  if (!client) {
    return {
      subject: `Re: ${anchor}`.slice(0, 120),
      body:
        `[Draft template — no language model configured; edit before use]\n\n` +
        `Hi ${recipient},\n\n` +
        `I'm reaching out from ${ctx.capability?.companyName ?? "our team"} about ${anchor}. ` +
        (ctx.trial ? `I saw ${ctx.trial.nctId} (${ctx.trial.phase.replace(/_/g, " ")}). ` : "") +
        `We work on ${(ctx.capability?.strengths ?? []).slice(0, 3).join(", ") || "diagnostics"} ` +
        `and I think there may be a fit worth a short conversation.\n\n` +
        `Would you be open to 20 minutes in the next couple of weeks?\n\nBest,\n`,
      meta: { model: null, requestId: null },
    };
  }

  const rich = await client.generateTextRich({
    system:
      "You draft concise, specific B2B outreach for an oncology diagnostics / BD team. " +
      "Ground every claim in the CONTEXT. Do not invent data, dates, or relationships. " +
      "No hype. 120-160 words. Return exactly:\nSUBJECT: <one line>\n\n<email body>",
    prompt: JSON.stringify(
      {
        recipient: ctx.person,
        account: ctx.organization,
        trial: ctx.trial,
        signal: ctx.signal,
        ourCapabilities: ctx.capability,
      },
      null,
      1,
    ),
    temperature: 0.4,
    timeoutMs: 40_000,
  });

  const text = rich.text.trim();
  const m = /^SUBJECT:\s*(.+?)\s*\n/i.exec(text);
  const subject = (m?.[1] ?? `Re: ${anchor}`).slice(0, 140);
  const body = m ? text.slice(m[0].length).trim() : text;
  return { subject, body, meta: { model: rich.meta.model, requestId: rich.meta.requestId } };
}
