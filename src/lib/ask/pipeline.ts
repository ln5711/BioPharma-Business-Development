import "server-only";
import { anthropic } from "@/lib/llm";
import { llmStatus } from "@/lib/llm/status";
import { extractIntent, type IntentContext } from "./intent";
import {
  companyDevelopments,
  getTrial,
  overdueTasks,
  resolveCompanies,
  searchSignals,
  searchTrials,
  type Evidence,
  type RetrievalCtx,
  type TrialPhase,
  type TrialStatus,
} from "./retrieval";
import type { AskCard, AskResponse, AskSource } from "./types";

const PHASE_TO_ENUM: Record<string, TrialPhase[]> = {
  "1": ["phase_1", "early_phase_1"],
  "1/2": ["phase_1_2"],
  "2": ["phase_2"],
  "2/3": ["phase_2_3"],
  "3": ["phase_3"],
  "4": ["phase_4"],
};
const STATUS_TO_ENUM: Record<string, TrialStatus[]> = {
  recruiting: ["recruiting"],
  not_yet_recruiting: ["not_yet_recruiting"],
  active: ["active_not_recruiting", "enrolling_by_invitation"],
  completed: ["completed"],
  terminated: ["terminated", "withdrawn", "suspended"],
};
const mapPhases = (xs: string[]): TrialPhase[] => [...new Set(xs.flatMap((x) => PHASE_TO_ENUM[x] ?? []))];
const mapStatuses = (xs: string[]): TrialStatus[] =>
  [...new Set(xs.flatMap((x) => STATUS_TO_ENUM[x] ?? []))];

export interface AskPipelineInput {
  query: string;
  ctx: RetrievalCtx;
  page: IntentContext;
  /** Prior assistant result cards, so "the second result" can be resolved. */
  previousCards?: { title: string; href: string }[];
  conversationId?: string | null;
  signal?: AbortSignal;
}

/**
 * The Ask newwin flow:
 *   intent → allowlisted, tenant-scoped retrieval → (optional web research) →
 *   grounded Claude answer with citations and links to the exact records.
 * Never substitutes an unrelated feed for missing results.
 */
export async function runAsk(input: AskPipelineInput): Promise<AskResponse> {
  const status = llmStatus();
  const client = anthropic();
  const { intent, source: intentSource } = await extractIntent(input.query, input.page, input.signal);

  const retrieval: { tool: string; count: number }[] = [];
  let evidence: Evidence[] = [];
  let extra: { comparison?: unknown[] } = {};
  let noResultsExplanation = "";

  const days = intent.timeframeDays ?? undefined;

  if (intent.intent === "overdue_tasks") {
    evidence = await overdueTasks(input.ctx);
    retrieval.push({ tool: "overdueTasks", count: evidence.length });
    if (!evidence.length) noResultsExplanation = "You have no overdue follow-ups or tasks with a past due date.";
  } else if (intent.intent === "company_developments") {
    const name = intent.companies[0] ?? input.page.contextCompany?.name;
    if (!name) {
      noResultsExplanation = "No company was named in the question.";
    } else {
      const matches = input.page.contextCompany
        ? [{ id: input.page.contextCompany.id, name: input.page.contextCompany.name }]
        : await resolveCompanies(input.ctx, { name });
      retrieval.push({ tool: "resolveCompanies", count: matches.length });
      if (!matches.length) {
        noResultsExplanation = `No account called "${name}" is in your workspace. Add it as a monitored company, or ask me to search external sources.`;
      } else {
        const dev = await companyDevelopments(input.ctx, {
          orgId: matches[0].id,
          sinceDays: days,
          phases: intent.phases.length ? mapPhases(intent.phases) : undefined,
          statuses: intent.statuses.length ? mapStatuses(intent.statuses) : undefined,
        });
        evidence = dev.evidence;
        retrieval.push({ tool: "companyDevelopments", count: evidence.length });
        if (!evidence.length) {
          noResultsExplanation = `No developments are recorded for ${matches[0].name}${
            days ? ` in the last ${days} day${days === 1 ? "" : "s"}` : ""
          }. This means nothing has been ingested for that account in the window — not that nothing happened.`;
        }
      }
    }
  } else if (intent.intent === "trial_search") {
    const res = await searchTrials(input.ctx, {
      company: intent.companies[0],
      biomarker: intent.biomarkers[0],
      indication: intent.indications[0],
      phases: intent.phases.length ? mapPhases(intent.phases) : undefined,
      statuses: intent.statuses.length ? mapStatuses(intent.statuses) : undefined,
      updatedWithinDays: days,
      nctId: intent.nctIds[0],
      limit: 15,
    });
    evidence = res.evidence;
    retrieval.push({ tool: "searchTrials", count: res.total });
    if (!evidence.length) {
      noResultsExplanation =
        "No trials in your workspace match all of those filters. Loosen a filter, or ask me to search ClinicalTrials.gov directly.";
    }
  } else if (intent.intent === "compare_trials") {
    let ncts = intent.nctIds;
    // Resolve "the second result" against previous cards.
    if (intent.refersToPreviousResult && input.previousCards?.length) {
      const card = input.previousCards[intent.refersToPreviousResult - 1];
      const m = card?.href.match(/\/trials\/(NCT\d{8})/i);
      if (m) ncts = [...new Set([...ncts, m[1].toUpperCase()])];
    }
    if (input.page.contextNctId) ncts = [...new Set([...ncts, input.page.contextNctId])];
    const full = (await Promise.all(ncts.slice(0, 4).map((n) => getTrial(input.ctx, { nctId: n })))).filter(
      Boolean,
    );
    retrieval.push({ tool: "getTrial", count: full.length });
    extra = { comparison: full };
    evidence = full.map((t) => ({
      kind: "trial" as const,
      id: t!.nctId,
      title: `${t!.nctId} — ${t!.title ?? ""}`,
      summary: [t!.phase, t!.status, t!.sponsorName].filter(Boolean).join(" · "),
      eventDate: t!.lastCtgovUpdate ?? t!.startDate,
      importedAt: t!.firstSeenAt,
      eventDateKind: t!.lastCtgovUpdate ? "source_update" : "first_posted",
      recordUrl: t!.recordUrl,
      sourceUrl: t!.sourceUrl,
      sourceLabel: "ClinicalTrials.gov",
    }));
    if (!full.length) noResultsExplanation = "I couldn't find those trials in your workspace to compare.";
  } else if (intent.intent === "draft_outreach") {
    // Resolve which record the draft is about: an ordinal into the previous
    // results, an explicit NCT id, or the page context.
    let target: { label: string; href: string } | null = null;
    if (intent.refersToPreviousResult && input.previousCards?.length) {
      const card = input.previousCards[intent.refersToPreviousResult - 1];
      if (card) {
        const nct = card.href.match(/\/trials\/(NCT\d{8})/i)?.[1];
        const sig = card.href.match(/[?&]signal=([0-9a-f-]{36})/i)?.[1];
        target = nct
          ? { label: card.title, href: `/outreach?trial=${nct.toUpperCase()}` }
          : sig
            ? { label: card.title, href: `/outreach?signal=${sig}` }
            : { label: card.title, href: card.href };
      }
    }
    if (!target && intent.nctIds[0]) {
      target = { label: intent.nctIds[0], href: `/outreach?trial=${intent.nctIds[0]}` };
    }
    if (!target && input.page.contextNctId) {
      target = { label: input.page.contextNctId, href: `/outreach?trial=${input.page.contextNctId}` };
    }
    if (!target && input.page.contextCompany) {
      target = {
        label: input.page.contextCompany.name,
        href: `/outreach?account=${input.page.contextCompany.id}`,
      };
    }
    retrieval.push({ tool: "draft_outreach", count: target ? 1 : 0 });
    if (target) {
      evidence = [
        {
          kind: "trial",
          id: target.label,
          title: `Compose outreach about ${target.label}`,
          summary: "Opens the composer with this record as grounding evidence.",
          eventDate: null,
          importedAt: null,
          eventDateKind: null,
          recordUrl: target.href,
          sourceUrl: null,
          sourceLabel: null,
        },
      ];
    } else {
      noResultsExplanation =
        "Tell me which result to draft about — e.g. \"draft outreach about the first result\" or name the trial.";
    }
  } else {
    // keyword_search
    const term = intent.companies[0] ?? intent.biomarkers[0] ?? intent.indications[0] ?? input.query;
    const res = await searchSignals(input.ctx, { term: term.slice(0, 120), sinceDays: days, limit: 12 });
    evidence = res.evidence;
    retrieval.push({ tool: "searchSignals", count: res.total });
    if (!evidence.length) {
      noResultsExplanation = `Nothing in your workspace matches "${input.query}". I did not substitute unrelated results.`;
    }
  }

  // ── external research (only when explicitly requested) ───────────────────
  let externalCitations: { url: string; title: string; citedText?: string }[] = [];
  let externalText = "";
  let mode: AskResponse["mode"] = client ? "database+ai" : "database";
  if (intent.wantsExternalResearch && client && status.webSearch) {
    try {
      const r = await client.research({
        system:
          "You are researching current oncology / clinical-trial developments. Prefer primary sources: " +
          "company press releases, ClinicalTrials.gov, and peer-reviewed publications. Cite every claim. " +
          "Do not rely on training memory for anything time-sensitive — use the search tool.",
        prompt: `Question: ${input.query}\nReturn a concise, cited answer using current sources.`,
        maxUses: 4,
        signal: input.signal,
      });
      externalText = r.text;
      externalCitations = r.citations;
      mode = "external+ai";
      retrieval.push({ tool: "web_search", count: r.citations.length });
    } catch {
      // fall through to DB-only answer; noted in the response
    }
  }

  // ── compose the answer ─────────────────────────────────────────────────
  const evidenceForModel = evidence.slice(0, 20).map((e, i) => ({
    n: i + 1,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    eventDate: e.eventDate,
    eventDateKind: e.eventDateKind,
    importedAt: e.importedAt,
    source: e.sourceLabel,
    sourceUrl: e.sourceUrl,
  }));

  let answer: string;
  let requestId: string | null = null;
  let usage: AskResponse["meta"]["usage"] = null;
  let model: string | null = null;

  if (!client) {
    // No model — deterministic answer from the evidence itself.
    answer = deterministicAnswer(intent.intent, evidence, noResultsExplanation);
    mode = "database";
  } else if (evidence.length === 0 && !externalText) {
    answer =
      noResultsExplanation ||
      "The workspace has no matching records for that question.";
  } else {
    try {
      const rich = await client.generateTextRich({
        system:
          "You are Ask newwin, an oncology business-development analyst. Answer the user's exact question. " +
          "Ground every statement ONLY in the EVIDENCE provided (workspace records) and EXTERNAL RESEARCH (if present). " +
          "Never introduce companies or trials that are not in the evidence. " +
          "Cite evidence items as [n]. When you mention a date, say whether it is the event/publication date or when newwin imported the record. " +
          "If the evidence does not answer the question, say so plainly and do not pad with unrelated items. " +
          "Keep it to 4-8 sentences. No preamble.",
        prompt: [
          `QUESTION: ${input.query}`,
          intent.timeframeDays ? `TIMEFRAME: last ${intent.timeframeDays} days` : "",
          `EVIDENCE (workspace records):\n${JSON.stringify(evidenceForModel, null, 1)}`,
          extra.comparison?.length ? `TRIALS TO COMPARE:\n${JSON.stringify(extra.comparison, null, 1)}` : "",
          externalText ? `EXTERNAL RESEARCH (current web sources):\n${externalText}` : "",
          noResultsExplanation ? `NOTE: ${noResultsExplanation}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        temperature: 0.2,
        signal: input.signal,
        timeoutMs: 40_000,
      });
      answer = rich.text.trim();
      requestId = rich.meta.requestId;
      usage = rich.meta.usage;
      model = rich.meta.model;
    } catch {
      answer = deterministicAnswer(intent.intent, evidence, noResultsExplanation);
      mode = "database";
    }
  }

  // ── cards + sources ───────────────────────────────────────────────────
  const cards: AskCard[] = evidence.slice(0, 8).map((e) => ({
    kind: e.kind.replace(/_/g, " "),
    title: e.title,
    subtitle: e.summary,
    eventDate: e.eventDate,
    eventDateKind: e.eventDateKind,
    why:
      e.eventDate && e.importedAt && e.eventDate !== e.importedAt
        ? [`Event ${short(e.eventDate)} · added to workspace ${short(e.importedAt)}`]
        : e.importedAt
          ? [`Added to workspace ${short(e.importedAt)}`]
          : undefined,
    actions: [
      { label: "Open record", href: e.recordUrl },
      ...(e.sourceUrl ? [{ label: e.sourceLabel ?? "Source", href: e.sourceUrl }] : []),
    ],
  }));

  const sources: AskSource[] = [
    ...evidence.slice(0, 12).map(
      (e): AskSource => ({
        kind: "workspace_record",
        label: e.sourceLabel ? `${e.title} — ${e.sourceLabel}` : e.title,
        url: e.sourceUrl ?? e.recordUrl,
        date: e.eventDate,
      }),
    ),
    ...externalCitations.map(
      (c): AskSource => ({ kind: "external", label: c.title, url: c.url, date: null }),
    ),
  ];
  if (client && (evidence.length || externalText)) {
    sources.push({
      kind: "interpretation",
      label: "Interpretation & suggested actions are generated by Claude from the evidence above.",
      url: null,
      date: null,
    });
  }

  const finalStatus: AskResponse["status"] =
    evidence.length === 0 && !externalText ? "no_results" : "ok";

  return {
    status: finalStatus,
    mode,
    answer,
    cards,
    sources,
    conversationId: input.conversationId ?? null,
    meta: {
      intent: intent.intent,
      intentSource,
      model,
      requestId,
      usage,
      retrieval,
      aiConfigured: status.configured,
    },
  };
}

export function unavailableResponse(reason: string): AskResponse {
  return {
    status: "unavailable",
    mode: "unavailable",
    answer: `Ask newwin's AI features are unavailable (${reason}). Database search still works — try a company name, an NCT id, or "recruiting KRAS trials in pancreatic cancer".`,
    cards: [],
    sources: [],
    conversationId: null,
    meta: {
      intent: "unavailable",
      intentSource: "heuristic",
      model: null,
      requestId: null,
      usage: null,
      retrieval: [],
      aiConfigured: false,
    },
  };
}

function deterministicAnswer(intent: string, evidence: Evidence[], noResults: string): string {
  if (!evidence.length) return noResults || "No matching records were found.";
  const lines = evidence
    .slice(0, 6)
    .map((e, i) => `${i + 1}. ${e.title}${e.eventDate ? ` (${short(e.eventDate)})` : ""} — ${e.summary}`);
  return `${evidence.length} matching record${evidence.length === 1 ? "" : "s"} from your workspace:\n${lines.join(
    "\n",
  )}\n\n(AI summary unavailable — showing the records directly.)`;
}

function short(iso: string): string {
  return iso.slice(0, 10);
}
