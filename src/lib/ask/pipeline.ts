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
import type { AskCard, AskResponse, AskSource, SynthesisState } from "./types";
import type { WebSearchCitation } from "@/lib/llm";

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
    // A token that's also a biomarker/asset is not a company filter.
    const bioLower = new Set(
      [...intent.biomarkers, ...intent.assets].map((s) => s.toLowerCase()),
    );
    const companyFilter = intent.companies.find((c) => !bioLower.has(c.toLowerCase()));
    const res = await searchTrials(input.ctx, {
      company: companyFilter,
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
    // Identify the record the draft is about (ordinal into previous cards, an
    // explicit NCT, or page context), then point at the Outreach workspace.
    let label: string | null = null;
    if (intent.refersToPreviousResult && input.previousCards?.length) {
      label = input.previousCards[intent.refersToPreviousResult - 1]?.title ?? null;
    }
    label ??= intent.nctIds[0] ?? input.page.contextNctId ?? input.page.contextCompany?.name ?? null;
    retrieval.push({ tool: "draft_outreach", count: label ? 1 : 0 });
    if (label) {
      evidence = [
        {
          kind: "task",
          id: label,
          title: `Draft outreach about ${label}`,
          summary: "Open Outreach to log or draft a message tied to this record.",
          eventDate: null,
          importedAt: null,
          eventDateKind: null,
          recordUrl: "/outreach",
          sourceUrl: null,
          sourceLabel: null,
        },
      ];
    } else {
      noResultsExplanation =
        'Tell me which result to draft about — e.g. "draft outreach about the first result".';
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

  // ─────────────────────────────────────────────────────────────────────────
  //  Compose the answer. Two independent paths that never overwrite each other:
  //   • wantsExternalResearch  → a web-research summary is the PRIMARY answer;
  //                              the workspace state is a separate note.
  //   • otherwise               → a workspace analysis (or an honest no-results).
  // ─────────────────────────────────────────────────────────────────────────
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

  let answer = "";
  let workspaceNote: string | null = null;
  let mode: AskResponse["mode"] = client ? "database+ai" : "database";
  let synthesis: SynthesisState = "skipped";
  let synthesisError: string | null = null;
  let requestId: string | null = null;
  let researchRequestId: string | null = null;
  let usage: AskResponse["meta"]["usage"] = null;
  let model: string | null = null;
  let externalCitations: { url: string; title: string }[] = [];

  const wantsExternal = intent.wantsExternalResearch;

  if (wantsExternal) {
    // ── PRIMARY: current web research ──────────────────────────────────────
    workspaceNote = evidence.length
      ? `Your workspace also has ${evidence.length} related record${evidence.length === 1 ? "" : "s"} (listed below).`
      : "Your workspace has no saved records on this topic yet.";

    if (!client || !status.webSearch) {
      answer =
        "Web search is unavailable in this environment (no AI provider configured), so I can't pull current sources. " +
        (evidence.length ? "Here is what your workspace holds instead — see the records below." : "");
      synthesis = "no_model";
      mode = "database";
    } else {
      const focus = [intent.companies[0], ...intent.topics].filter(Boolean).join(" ");
      let researchText = "";
      try {
        const r = await client.research({
          system:
            "You research CURRENT developments using the web_search tool. " +
            "Prefer primary sources: company press releases and investor updates, ClinicalTrials.gov, " +
            "regulator notices (FDA/EMA), and peer-reviewed journals. " +
            "Write a readable briefing of 6-12 sentences. Attribute each claim to its source and give the date. " +
            "Group multiple reports of the same announcement together — do not repeat regional or syndicated versions. " +
            "Do not rely on training memory for anything time-sensitive.",
          prompt:
            `Question: ${input.query}\n` +
            (focus ? `Focus: ${focus}\n` : "") +
            "Return a dated, source-attributed summary.",
          maxUses: 5,
          signal: input.signal,
        });
        researchText = r.text.trim();
        externalCitations = dedupeCitations(r.citations);
        researchRequestId = r.meta.requestId;
        model = r.meta.model;
        usage = r.meta.usage;
        retrieval.push({ tool: "web_search", count: externalCitations.length });
        mode = "external+ai";

        if (researchText.length >= 60) {
          answer = researchText;
          requestId = r.meta.requestId;
          synthesis = "ok";
        } else if (externalCitations.length > 0) {
          // Got sources but no usable prose — run one explicit synthesis pass.
          try {
            const rich = await client.generateTextRich({
              system:
                "Summarise the retrieved web sources into a readable, dated, source-attributed briefing " +
                "of 6-12 sentences about the exact question. Merge duplicate coverage of the same announcement. " +
                "Every claim must be traceable to one of the listed sources.",
              prompt:
                `QUESTION: ${input.query}\n\nRETRIEVED SOURCES:\n` +
                externalCitations
                  .map((c, i) => `[${i + 1}] ${c.title} — ${c.url}`)
                  .join("\n"),
              temperature: 0.2,
              signal: input.signal,
              timeoutMs: 40_000,
            });
            answer = rich.text.trim();
            requestId = rich.meta.requestId;
            usage = rich.meta.usage ?? usage;
            model = rich.meta.model ?? model;
            synthesis = answer.length >= 40 ? "ok" : "failed";
            if (synthesis === "failed") synthesisError = "the summary step returned no usable text";
          } catch (err) {
            synthesis = "failed";
            synthesisError = (err as Error)?.message?.slice(0, 160) ?? "synthesis request failed";
            answer =
              "I retrieved current web sources but the summary step failed. The links are below — open them directly.";
          }
        } else {
          synthesis = "failed";
          synthesisError = "web search returned no results";
          answer = `I searched the web for "${input.query}" but found no usable current sources.`;
        }
      } catch (err) {
        synthesis = "failed";
        synthesisError = (err as Error)?.message?.slice(0, 160) ?? "web_search request failed";
        answer =
          "The web search could not be completed (the AI provider errored). " +
          (evidence.length ? "Your workspace records are listed below." : "Please try again in a moment.");
        mode = "database";
      }
    }
  } else {
    // ── PRIMARY: workspace analysis ───────────────────────────────────────
    if (!client) {
      answer = deterministicAnswer(intent.intent, evidence, noResultsExplanation);
      synthesis = "no_model";
      mode = "database";
    } else if (evidence.length === 0) {
      answer = noResultsExplanation || "The workspace has no matching records for that question.";
      synthesis = "skipped";
      mode = "database";
    } else {
      try {
        const rich = await client.generateTextRich({
          system:
            "You are Ask newwin, an oncology business-development analyst. Answer the user's exact question. " +
            "Ground every statement ONLY in the EVIDENCE provided (workspace records). " +
            "Never introduce companies or trials that are not in the evidence. " +
            "Cite evidence items as [n]. When you mention a date, say whether it is the event/publication date " +
            "or when newwin imported the record. If the evidence does not answer the question, say so plainly. " +
            "Keep it to 4-8 sentences. No preamble.",
          prompt: [
            `QUESTION: ${input.query}`,
            intent.timeframeDays ? `TIMEFRAME: last ${intent.timeframeDays} days` : "",
            `EVIDENCE (workspace records):\n${JSON.stringify(evidenceForModel, null, 1)}`,
            extra.comparison?.length
              ? `TRIALS TO COMPARE:\n${JSON.stringify(extra.comparison, null, 1)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          temperature: 0.2,
          signal: input.signal,
          timeoutMs: 40_000,
        });
        answer = rich.text.trim() || deterministicAnswer(intent.intent, evidence, noResultsExplanation);
        requestId = rich.meta.requestId;
        usage = rich.meta.usage;
        model = rich.meta.model;
        synthesis = rich.text.trim().length >= 30 ? "ok" : "failed";
        mode = "database+ai";
      } catch (err) {
        synthesis = "failed";
        synthesisError = (err as Error)?.message?.slice(0, 160) ?? "synthesis request failed";
        answer = deterministicAnswer(intent.intent, evidence, noResultsExplanation);
        mode = "database";
      }
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
  if (client && synthesis === "ok") {
    sources.push({
      kind: "interpretation",
      label: wantsExternal
        ? "This summary is written by Claude from the current web sources above."
        : "Interpretation & suggested actions are generated by Claude from the workspace evidence above.",
      url: null,
      date: null,
    });
  }

  // Honest final status.
  let finalStatus: AskResponse["status"];
  if (synthesis === "no_model" && wantsExternal) {
    finalStatus = "unavailable";
  } else if (wantsExternal) {
    finalStatus = synthesis === "ok" || externalCitations.length > 0 ? "ok" : "error";
  } else {
    finalStatus = evidence.length === 0 ? "no_results" : synthesis === "failed" ? "error" : "ok";
  }

  return {
    status: finalStatus,
    mode,
    answer,
    workspaceNote,
    cards,
    sources,
    conversationId: input.conversationId ?? null,
    meta: {
      intent: intent.intent,
      intentSource,
      model,
      requestId,
      researchRequestId,
      usage,
      retrieval,
      aiConfigured: status.configured,
      synthesis,
      synthesisError,
    },
  };
}

export function unavailableResponse(reason: string): AskResponse {
  return {
    status: "unavailable",
    mode: "unavailable",
    answer: `Ask newwin's AI features are unavailable (${reason}). Database search still works — try a company name, an NCT id, or "recruiting KRAS trials in pancreatic cancer".`,
    workspaceNote: null,
    cards: [],
    sources: [],
    conversationId: null,
    meta: {
      intent: "unavailable",
      intentSource: "heuristic",
      model: null,
      requestId: null,
      researchRequestId: null,
      usage: null,
      retrieval: [],
      aiConfigured: false,
      synthesis: "no_model",
      synthesisError: reason,
    },
  };
}

/**
 * Collapse duplicate coverage of the same announcement — exact URL, then a
 * normalised-title key (so regional / syndicated / press-wire reposts of the
 * same headline fold into one).
 */
function dedupeCitations(list: WebSearchCitation[]): { url: string; title: string }[] {
  const seenUrl = new Set<string>();
  const seenKey = new Set<string>();
  const out: { url: string; title: string }[] = [];
  for (const c of list) {
    if (!c.url) continue;
    let host = "";
    try {
      host = new URL(c.url).hostname.replace(/^www\./, "");
    } catch {
      /* keep host empty */
    }
    if (seenUrl.has(c.url)) continue;
    const titleKey = (c.title ?? "")
      .toLowerCase()
      .replace(/\b(reuters|bloomberg|globenewswire|pr newswire|businesswire|yahoo|fierce\w*)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 10)
      .join(" ");
    const key = titleKey.length > 12 ? titleKey : `${host}|${titleKey}`;
    if (key && seenKey.has(key)) continue;
    seenUrl.add(c.url);
    if (key) seenKey.add(key);
    out.push({ url: c.url, title: c.title || c.url });
  }
  return out;
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
