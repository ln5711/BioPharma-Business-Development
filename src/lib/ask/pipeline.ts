import "server-only";
import { anthropic } from "@/lib/llm";
import { llmStatus } from "@/lib/llm/status";
import { extractIntent, type IntentContext } from "./intent";
import {
  getTrial,
  overdueTasks,
  searchSignals,
  searchTrials,
  type Evidence,
  type RetrievalCtx,
} from "./retrieval";
import { ctgovSearch } from "./public-research";
import {
  getCachedResearch,
  putCachedResearch,
  researchCacheKey,
  type CachedResearch,
} from "./research-cache";
import { runSearch } from "@/lib/search/search";
import { parseQuery } from "@/lib/search/parse-query";
import type {
  ParsedQuery,
  SearchResult,
  TrialSearchResult,
} from "@/lib/search/types";
import type { AskCard, AskResponse, AskSource, SynthesisState } from "./types";
import type { WebSearchCitation } from "@/lib/llm";

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

  // Deterministic structured parse — the authoritative router. Freshness words
  // ("today", "latest") are recognised as freshness here, never as a signal to
  // open the Home recommendation flow.
  const parsed = parseQuery(input.query);
  if (parsed.intents.priorities && intent.intent !== "personal") {
    intent.intent = "personal";
    intent.personalKind = "priorities";
  }

  const retrieval: { tool: string; count: number }[] = [];
  const baseMeta = {
    intent: intent.intent,
    intentSource,
    model: null as string | null,
    requestId: null as string | null,
    researchRequestId: null as string | null,
    usage: null as AskResponse["meta"]["usage"],
    retrieval,
    aiConfigured: status.configured,
    synthesis: "skipped" as SynthesisState,
    synthesisError: null as string | null,
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PERSONAL — the signed-in user's own saved records only.
  // ═══════════════════════════════════════════════════════════════════════
  if (intent.intent === "personal") {
    const { evidence, note } = await personalRetrieval(input.ctx, intent.personalKind);
    retrieval.push({ tool: `personal:${intent.personalKind}`, count: evidence.length });

    let answer = note;
    let synthesis: SynthesisState = "skipped";
    let requestId: string | null = null;
    let model: string | null = null;
    if (client && evidence.length) {
      try {
        const rich = await client.generateTextRich({
          system:
            "You are Ask newwin. Summarise the user's OWN records below in 2-5 sentences. " +
            "Only use what is listed. No preamble.",
          prompt: `QUESTION: ${input.query}\n\nRECORDS:\n${JSON.stringify(evForModel(evidence), null, 1)}`,
          signal: input.signal,
          timeoutMs: 30_000,
        });
        answer = rich.text.trim() || note;
        requestId = rich.meta.requestId;
        model = rich.meta.model;
        synthesis = "ok";
      } catch (err) {
        synthesis = "failed";
        baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? null;
      }
    }
    return {
      status: evidence.length ? "ok" : "no_results",
      mode: client && synthesis === "ok" ? "database+ai" : "database",
      answer,
      workspaceNote: null,
      cards: evidence.slice(0, 8).map((e) => toCard(e, "workspace")),
      sources: evidence.slice(0, 10).map(
        (e): AskSource => ({
          kind: "workspace_record",
          label: e.title,
          url: e.sourceUrl ?? e.recordUrl,
          date: e.eventDate,
        }),
      ),
      suggestions: [],
      conversationId: input.conversationId ?? null,
      meta: { ...baseMeta, model, requestId, synthesis },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  COMPARE TRIALS — specific NCT ids (workspace first, then live CT.gov).
  // ═══════════════════════════════════════════════════════════════════════
  if (intent.intent === "compare_trials") {
    let ncts = [...intent.nctIds];
    if (intent.refersToPreviousResult && input.previousCards?.length) {
      const m = input.previousCards[intent.refersToPreviousResult - 1]?.href.match(/(NCT\d{8})/i);
      if (m) ncts.push(m[1].toUpperCase());
    }
    if (input.page.contextNctId) ncts.push(input.page.contextNctId);
    ncts = [...new Set(ncts)].slice(0, 4);

    const full = (
      await Promise.all(ncts.map((n) => getTrial(input.ctx, { nctId: n })))
    ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getTrial>>>[];
    retrieval.push({ tool: "getTrial", count: full.length });

    const evidence: Evidence[] = full.map((t) => ({
      kind: "trial",
      id: t.nctId,
      title: `${t.nctId} — ${t.title ?? ""}`,
      summary: [t.phase, t.status, t.sponsorName].filter(Boolean).join(" · "),
      eventDate: t.lastCtgovUpdate ?? t.startDate,
      importedAt: t.firstSeenAt,
      eventDateKind: t.lastCtgovUpdate ? "source_update" : "first_posted",
      recordUrl: t.recordUrl,
      sourceUrl: t.sourceUrl,
      sourceLabel: "ClinicalTrials.gov",
    }));

    let answer = full.length
      ? deterministicAnswer("compare_trials", evidence, "")
      : "I couldn't find those trials to compare.";
    let synthesis: SynthesisState = "skipped";
    let requestId: string | null = null;
    let model: string | null = null;
    if (client && full.length >= 1) {
      try {
        const rich = await client.generateTextRich({
          system:
            "You are Ask newwin. Compare the trials below across phase, status, sponsor, " +
            "population, endpoints and biomarker requirements. Cite each trial as [NCT…]. " +
            "6-10 sentences, plain prose.",
          prompt: `QUESTION: ${input.query}\n\nTRIALS:\n${JSON.stringify(full, null, 1)}`,
          signal: input.signal,
          timeoutMs: 40_000,
        });
        answer = rich.text.trim() || answer;
        requestId = rich.meta.requestId;
        model = rich.meta.model;
        synthesis = "ok";
      } catch (err) {
        synthesis = "failed";
        baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? null;
      }
    }
    return {
      status: full.length ? "ok" : "no_results",
      mode: synthesis === "ok" ? "database+ai" : "database",
      answer,
      workspaceNote: null,
      cards: evidence.map((e) => toCard(e, "workspace")),
      sources: evidence.map(
        (e): AskSource => ({ kind: "workspace_record", label: e.title, url: e.sourceUrl, date: e.eventDate }),
      ),
      suggestions: [],
      conversationId: input.conversationId ?? null,
      meta: { ...baseMeta, model, requestId, synthesis },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DRAFT OUTREACH — point at the Outreach workspace.
  // ═══════════════════════════════════════════════════════════════════════
  if (intent.intent === "draft_outreach") {
    let label: string | null = null;
    if (intent.refersToPreviousResult && input.previousCards?.length) {
      label = input.previousCards[intent.refersToPreviousResult - 1]?.title ?? null;
    }
    label ??= intent.nctIds[0] ?? intent.companies[0] ?? input.page.contextCompany?.name ?? null;
    return {
      status: "ok",
      mode: "database",
      answer: label
        ? `Open Outreach to draft or log a message about ${label}.`
        : 'Tell me which result to draft about — e.g. "draft outreach about the first result".',
      workspaceNote: null,
      cards: label
        ? [
            {
              kind: "outreach",
              title: `Draft outreach about ${label}`,
              subtitle: "Open the Outreach workspace.",
              origin: "workspace",
              actions: [{ label: "Open Outreach", href: "/outreach" }],
            },
          ]
        : [],
      sources: [],
      suggestions: [],
      conversationId: input.conversationId ?? null,
      meta: baseMeta,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  STRUCTURED SEARCH — hybrid local + live ClinicalTrials.gov, plus the
  //  workspace's own signals / companies / people. Triggered by any concrete
  //  content-type or entity ("KRAS trials", "RMC-6236", "phase 3 KRAS trials",
  //  an NCT id, "Amgen KRAS trials", "what changed in KRAS this week").
  // ═══════════════════════════════════════════════════════════════════════
  const structuredSearch =
    intent.intent === "public_research" &&
    !parsed.intents.priorities &&
    (parsed.nctIds.length > 0 ||
      parsed.intents.trials ||
      parsed.intents.people ||
      parsed.phases.length > 0 ||
      parsed.statuses.length > 0 ||
      (parsed.intents.signals &&
        (parsed.biomarkers.length > 0 || parsed.assets.length > 0 || parsed.companies.length > 0)));

  if (structuredSearch) {
    const search = await runSearch(input.query, {
      tenantId: input.ctx.tenantId,
      live: true,
      persist: true,
      trialLimit: 20,
    }).catch((err): SearchResult | null => {
      baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? "search failed";
      return null;
    });

    const total =
      (search?.trials.length ?? 0) +
      (search?.companies.length ?? 0) +
      (search?.signals.length ?? 0) +
      (search?.people.length ?? 0);

    if (search) {
      retrieval.push({ tool: "search:trials", count: search.trials.length });
      retrieval.push({ tool: "search:ctgov_live", count: search.meta.liveTrialCount });
      if (search.companies.length) retrieval.push({ tool: "search:companies", count: search.companies.length });
      if (search.signals.length) retrieval.push({ tool: "search:signals", count: search.signals.length });
      if (search.people.length) retrieval.push({ tool: "search:people", count: search.people.length });
      if (search.meta.upserted) retrieval.push({ tool: "search:upserted", count: search.meta.upserted });
    }

    // Nothing structured AND we can do a web pass → fall through to it below.
    const canWebFallback = !!client && status.webSearch;
    if (total > 0 || !canWebFallback) {
      return buildSearchResponse(input, parsed, search, {
        client,
        baseMeta,
        retrieval,
      });
    }
    // else: fall through to PUBLIC RESEARCH (web) as the last resort.
    retrieval.push({ tool: "search:empty_fallback_to_web", count: 0 });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC RESEARCH — the default. ClinicalTrials.gov + web + (secondary)
  //  the user's saved workspace. Missing saved records never block this.
  // ═══════════════════════════════════════════════════════════════════════
  const companyTopic = [intent.companies[0], ...intent.topics, ...intent.personRoles]
    .filter(Boolean)
    .join(" ");
  const ctTerms = [
    ...intent.biomarkers,
    ...intent.assets,
    ...(intent.companies[0] ? [intent.companies[0]] : []),
    ...(intent.biomarkers.length || intent.assets.length ? [] : intent.topics),
  ];
  const ctConds = intent.indications;
  const wantsTrials =
    intent.nctIds.length === 0 &&
    (ctTerms.length > 0 || ctConds.length > 0) &&
    intent.personRoles.length === 0;

  // Workspace retrieval always runs fresh (tenant-scoped, never cached).
  const [wsTrialsRes, wsSignalsRes] = await Promise.all([
    searchTrials(input.ctx, {
      company: intent.companies[0],
      biomarker: intent.biomarkers[0],
      indication: intent.indications[0],
      limit: 5,
    }).catch(() => ({ evidence: [], total: 0 })),
    searchSignals(input.ctx, {
      term: (intent.companies[0] ?? intent.biomarkers[0] ?? intent.indications[0] ?? input.query).slice(0, 120),
      limit: 6,
    }).catch(() => ({ evidence: [], total: 0 })),
  ]);
  retrieval.push({ tool: "workspace_trials", count: wsTrialsRes.evidence.length });
  retrieval.push({ tool: "workspace_signals", count: wsSignalsRes.evidence.length });

  // ── the PUBLIC half: served from cache when fresh, else computed once ──
  const cacheKey = researchCacheKey({
    query: input.query,
    companies: intent.companies,
    topics: intent.topics,
    biomarkers: intent.biomarkers,
    indications: intent.indications,
    assets: intent.assets,
    personRoles: intent.personRoles,
    statuses: intent.statuses,
    wantsExternalResearch: intent.wantsExternalResearch,
  });
  const cached = await getCachedResearch(cacheKey);

  let ctgovTrials: import("./public-research").PublicTrial[] = [];
  let webText = "";
  let externalCitations: { url: string; title: string }[] = [];
  let researchRequestId: string | null = null;
  let webUsage: AskResponse["meta"]["usage"] = null;
  let webFailed = false;

  let answer = "";
  let synthesis: SynthesisState = "skipped";
  let finalRequestId: string | null = null;
  let finalModel: string | null = null;
  let finalUsage: AskResponse["meta"]["usage"] = null;
  let mode: AskResponse["mode"] = "external+ai";

  if (cached) {
    ctgovTrials = cached.ctgovTrials ?? [];
    webText = cached.webText ?? "";
    externalCitations = cached.externalCitations ?? [];
    researchRequestId = cached.researchRequestId;
    answer = cached.answer;
    synthesis = cached.synthesis;
    finalRequestId = cached.researchRequestId;
    finalModel = cached.model;
    mode = synthesis === "no_model" ? "database" : "external+ai";
    (baseMeta as { _suggestions?: string[] })._suggestions = cached.suggestions?.length
      ? cached.suggestions
      : defaultSuggestions(intent);
    retrieval.push({ tool: "research_cache", count: ctgovTrials.length + externalCitations.length });
  } else {
    // 1. structured trial discovery
    if (wantsTrials) {
      ctgovTrials = await ctgovSearch({
        terms: ctTerms,
        conditions: ctConds,
        statuses: intent.statuses.length
          ? intent.statuses.flatMap((s) => CTGOV_STATUS[s] ?? [])
          : undefined,
        limit: 10,
        signal: input.signal,
      }).catch(() => []);
      retrieval.push({ tool: "ctgov_search", count: ctgovTrials.length });
    }

    // 2. current public information via web search
    let webModel: string | null = null;
    if (client && status.webSearch) {
      try {
        const focus = companyTopic || intent.biomarkers[0] || intent.indications[0] || input.query;
        const r = await client.research({
          system:
            "Research the user's topic using the web_search tool for CURRENT public information. " +
            "Prefer primary sources: company press releases and investor updates, ClinicalTrials.gov, " +
            "FDA/EMA notices, peer-reviewed journals, and reputable trade press. " +
            "Write a readable briefing in plain prose paragraphs (NO markdown headings/bullets/bold), " +
            "6-12 sentences. Attribute each claim to its source and give the date. " +
            "Merge duplicate coverage of the same announcement. Do NOT rely on training memory for " +
            "time-sensitive facts — use the tool. If asked about people, give names, titles and a source each.",
          prompt:
            `Question: ${input.query}\n` +
            (focus ? `Focus: ${focus}\n` : "") +
            (intent.wantsExternalResearch ? "Emphasise the most recent developments.\n" : "") +
            "Return a dated, source-attributed briefing.",
          maxUses: 5,
          signal: input.signal,
        });
        webText = r.text.trim();
        externalCitations = dedupeCitations(r.citations);
        researchRequestId = r.meta.requestId;
        webUsage = r.meta.usage;
        webModel = r.meta.model;
        retrieval.push({ tool: "web_search", count: externalCitations.length });
      } catch (err) {
        webFailed = true;
        baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? "web_search failed";
      }
    }

    finalRequestId = researchRequestId;
    finalModel = webModel;
    finalUsage = webUsage;

    // 3. grounded synthesis
    const ctgovBlock = ctgovTrials.length
      ? `CLINICALTRIALS.GOV RESULTS (${ctgovTrials.length}):\n` +
        ctgovTrials
          .map(
            (t, i) =>
              `[${i + 1}] ${t.nctId} — ${t.title} · ${t.phase} · ${t.status} · sponsor ${t.sponsor ?? "?"} · ` +
              `conditions ${t.conditions.join(", ")} · first posted ${t.firstPostedDate ?? "?"}`,
          )
          .join("\n")
      : "";

    if (!client || !status.webSearch) {
      mode = "database";
      synthesis = "no_model";
      answer =
        (webFailed ? "" : "AI research is not configured in this environment, so I can't synthesise a briefing. ") +
        (ctgovTrials.length
          ? `Here are ${ctgovTrials.length} current ClinicalTrials.gov results for your query (cards below).`
          : "No structured trial results were found for that query.");
    } else if (webFailed && !ctgovTrials.length) {
      mode = "database";
      synthesis = "failed";
      answer =
        "The web research step failed and no structured trial results were found. Please try again in a moment.";
    } else {
      try {
        const rich = await client.generateTextRich({
          system:
            "You are Ask newwin, an oncology research analyst. Answer the user's query as a PUBLIC RESEARCH briefing. " +
            "Ground every statement ONLY in the WEB RESEARCH text and the CLINICALTRIALS.GOV RESULTS provided. " +
            "Do not use unstated training knowledge for specific facts, numbers, dates or names. " +
            "Write PLAIN PROSE ONLY — no markdown whatsoever: no headings or '#', no bullet or numbered lists, " +
            "no bold or '**', no tables. Short paragraphs, 6-12 sentences total, each claim attributed to a source with its date. " +
            "For a broad one-word topic, give a concise orientation (what it is, why it matters, the current landscape). " +
            "End with a line 'NARROW: ' followed by 3-4 comma-separated follow-up angles the user could search next.",
          prompt: [
            `QUERY: ${input.query}`,
            companyTopic ? `INTERPRETED AS: ${companyTopic}` : "",
            webText ? `WEB RESEARCH:\n${webText}` : "(web research returned no text)",
            ctgovBlock,
          ]
            .filter(Boolean)
            .join("\n\n"),
          maxTokens: 4096,
          signal: input.signal,
          timeoutMs: 45_000,
        });
        let text = stripMarkdown(rich.text.trim());
        finalRequestId = rich.meta.requestId;
        finalModel = rich.meta.model;
        finalUsage = rich.meta.usage ?? webUsage;
        const nm = text.match(/\nNARROW:\s*(.+?)\s*$/i);
        const suggestionList = nm
          ? nm[1].split(/[,;]/).map((s) => s.trim().replace(/^[-•]\s*/, "")).filter(Boolean).slice(0, 4)
          : [];
        if (nm) text = text.slice(0, nm.index).trim();
        answer = text || webText || `Found ${ctgovTrials.length} ClinicalTrials.gov results (below).`;
        synthesis = answer.length >= 60 ? "ok" : "failed";
        (baseMeta as { _suggestions?: string[] })._suggestions = suggestionList.length
          ? suggestionList
          : defaultSuggestions(intent);
      } catch (err) {
        synthesis = "failed";
        baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? "synthesis failed";
        answer =
          (webText ? `${webText}\n\n` : "") +
          (ctgovTrials.length ? `Plus ${ctgovTrials.length} ClinicalTrials.gov results (below).` : "") ||
          "The research summary step failed. Any retrieved links and trials are shown below.";
      }
    }

    // Cache the public half when it is genuinely useful (never a failure state).
    if (synthesis === "ok" || (synthesis === "no_model" && ctgovTrials.length > 0)) {
      const toCache: CachedResearch = {
        answer,
        synthesis: synthesis as CachedResearch["synthesis"],
        webText,
        externalCitations,
        ctgovTrials,
        suggestions: (baseMeta as { _suggestions?: string[] })._suggestions ?? [],
        researchRequestId,
        model: finalModel,
      };
      void putCachedResearch(cacheKey, toCache);
    }
  }

  // ── cards: public first, then the user's saved workspace ──────────────
  const publicCards: AskCard[] = ctgovTrials.map((t) => ({
    kind: "trial (public)",
    title: `${t.nctId} — ${t.title}`,
    subtitle: [t.phase, t.status, t.sponsor, t.conditions.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
    eventDate: t.firstPostedDate,
    eventDateKind: "first_posted",
    origin: "public",
    actions: [{ label: "ClinicalTrials.gov ↗", href: t.url }],
    save: {
      kind: "trial",
      label: "Save to workspace",
      payload: { nctId: t.nctId },
    },
  }));
  if (intent.companies[0] || companyTopic) {
    publicCards.push({
      kind: "monitor",
      title: `Monitor "${intent.companies[0] ?? companyTopic}"`,
      subtitle: "Create a saved ClinicalTrials.gov watch for this topic.",
      origin: "public",
      actions: [],
      save: {
        kind: "watchlist",
        label: "Monitor this topic",
        payload: {
          name: (intent.companies[0] ?? companyTopic).slice(0, 60),
          terms: [...intent.biomarkers, ...intent.assets, intent.companies[0] ?? ""].filter(Boolean).join(","),
          conditions: intent.indications.join(","),
        },
      },
    });
  }

  const wsCards: AskCard[] = [
    ...wsTrialsRes.evidence.slice(0, 4).map((e) => toCard(e, "workspace")),
    ...wsSignalsRes.evidence.slice(0, 4).map((e) => toCard(e, "workspace")),
  ];

  const sources: AskSource[] = [
    ...externalCitations.map((c): AskSource => ({ kind: "external", label: c.title, url: c.url, date: null })),
    ...ctgovTrials.slice(0, 8).map(
      (t): AskSource => ({ kind: "external", label: `${t.nctId} — ClinicalTrials.gov`, url: t.url, date: t.firstPostedDate }),
    ),
    ...wsCards.slice(0, 8).map(
      (c): AskSource => ({ kind: "workspace_record", label: c.title, url: c.actions[0]?.href ?? null, date: c.eventDate ?? null }),
    ),
  ];
  if (client && synthesis === "ok") {
    sources.push({
      kind: "interpretation",
      label: "This briefing is written by Claude from the public sources above — not from its training data.",
      url: null,
      date: null,
    });
  }

  const workspaceNote = wsCards.length
    ? `You also have ${wsCards.length} related saved record${wsCards.length === 1 ? "" : "s"} (below).`
    : "You have no saved records for this yet — the results above are public research.";

  const anythingUseful = answer.length > 40 || publicCards.length > 0 || wsCards.length > 0;

  return {
    status: anythingUseful ? "ok" : webFailed ? "error" : "no_results",
    mode,
    answer,
    workspaceNote,
    cards: [...publicCards, ...wsCards],
    sources,
    suggestions: (baseMeta as { _suggestions?: string[] })._suggestions ?? defaultSuggestions(intent),
    conversationId: input.conversationId ?? null,
    meta: {
      ...baseMeta,
      model: finalModel,
      requestId: finalRequestId,
      researchRequestId,
      usage: finalUsage,
      synthesis,
    },
  };
}

const CTGOV_STATUS: Record<string, string[]> = {
  recruiting: ["RECRUITING"],
  not_yet_recruiting: ["NOT_YET_RECRUITING"],
  active: ["ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"],
  completed: ["COMPLETED"],
  terminated: ["TERMINATED", "WITHDRAWN", "SUSPENDED"],
};

function evForModel(evidence: Evidence[]) {
  return evidence.slice(0, 12).map((e, i) => ({
    n: i + 1,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    date: e.eventDate,
  }));
}

function toCard(e: Evidence, origin: "public" | "workspace"): AskCard {
  return {
    kind: e.kind.replace(/_/g, " "),
    title: e.title,
    subtitle: e.summary,
    eventDate: e.eventDate,
    eventDateKind: e.eventDateKind,
    origin,
    actions: [
      { label: "Open record", href: e.recordUrl },
      ...(e.sourceUrl ? [{ label: e.sourceLabel ?? "Source ↗", href: e.sourceUrl }] : []),
    ],
  };
}

function defaultSuggestions(intent: {
  biomarkers: string[];
  indications: string[];
  companies: string[];
  topics?: string[];
  assets?: string[];
}): string[] {
  const b = intent.biomarkers[0];
  const c = intent.companies[0];
  const a = intent.assets?.[0];
  const ind = intent.indications[0];
  if (b)
    return [
      `${b} G12C inhibitors`,
      ind ? `${b} trials in ${ind}` : `${b} trials in pancreatic cancer`,
      `companies developing ${b} drugs`,
      `${b} resistance mechanisms`,
    ];
  if (c)
    return [
      `${c} oncology pipeline`,
      `${c} recent FDA approvals`,
      `${c} clinical trials`,
      `${c} partnering and licensing deals`,
    ];
  if (a) return [`${a} clinical trials`, `${a} mechanism of action`, `${a} competitors`];
  const t = intent.topics?.[0];
  if (t) return [`recent ${t} approvals`, `${t} clinical trials`, `companies leading in ${t}`];
  return [];
}

async function personalRetrieval(
  ctx: RetrievalCtx,
  kind: string,
): Promise<{ evidence: Evidence[]; note: string }> {
  if (kind === "overdue_tasks" || kind === "tasks") {
    const ev = await overdueTasks(ctx);
    return {
      evidence: ev,
      note: ev.length
        ? `You have ${ev.length} overdue item${ev.length === 1 ? "" : "s"}.`
        : "You have no overdue follow-ups or tasks with a past due date.",
    };
  }
  if (kind === "priorities") {
    const { getUserPrefs } = await import("@/lib/user-prefs");
    const prefs = await getUserPrefs(ctx.userId);
    const active = prefs.priorities.filter((p) => !p.paused);
    return {
      evidence: active.map((p) => ({
        kind: "task",
        id: p.id,
        title: p.text,
        summary: p.recommendedId ? "recommended priority" : "custom priority",
        eventDate: null,
        importedAt: null,
        eventDateKind: null,
        recordUrl: "/settings",
        sourceUrl: null,
        sourceLabel: null,
      })),
      note: active.length
        ? `Your active priorities: ${active.map((p) => p.text).join("; ")}.`
        : "You have no active priorities. Add some in Settings.",
    };
  }
  if (kind === "contacts") {
    const { getDb } = await import("@/db");
    const { people, organizations } = await import("@/db/schema");
    const { and, eq, desc } = await import("drizzle-orm");
    const db = await getDb();
    const rows = await db
      .select({ id: people.id, name: people.name, title: people.title, org: organizations.canonicalName, orgId: people.organizationId })
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.organizationId))
      .where(eq(people.tenantId, ctx.tenantId))
      .orderBy(desc(people.relevanceScore))
      .limit(10);
    void and;
    return {
      evidence: rows.map((r) => ({
        kind: "company",
        id: r.id,
        title: r.name,
        summary: [r.title, r.org].filter(Boolean).join(" · "),
        eventDate: null,
        importedAt: null,
        eventDateKind: null,
        recordUrl: r.orgId ? `/accounts/${r.orgId}` : "/accounts",
        sourceUrl: null,
        sourceLabel: null,
      })),
      note: rows.length ? `${rows.length} saved contacts.` : "You have no saved contacts yet.",
    };
  }
  return {
    evidence: [],
    note: "That's a personal request. Your priorities and profile live in Settings; tasks and follow-ups on Home and Outreach.",
  };
}

export function unavailableResponse(reason: string): AskResponse {
  return {
    status: "unavailable",
    mode: "unavailable",
    answer: `Ask newwin's AI features are unavailable (${reason}). ClinicalTrials.gov search still works — try a biomarker, a disease, or an NCT id.`,
    workspaceNote: null,
    cards: [],
    sources: [],
    suggestions: [],
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

// ═══════════════════════════════════════════════════════════════════════════
//  Structured-search → AskResponse
// ═══════════════════════════════════════════════════════════════════════════

function trialCard(t: TrialSearchResult): AskCard {
  const bits = [
    t.phaseLabel !== "—" ? t.phaseLabel : null,
    t.statusLabel,
    t.sponsor,
    t.interventions[0] ?? null,
    t.conditions[0] ?? null,
  ].filter(Boolean);
  const src = t.source === "workspace" ? "In your workspace" : "ClinicalTrials.gov";
  const upd = t.lastUpdate ? ` · updated ${t.lastUpdate}` : "";
  return {
    kind: "trial",
    title: `${t.nctId} — ${t.title}`,
    subtitle: bits.join(" · "),
    why: [
      ...(t.biomarkers.length ? [t.biomarkers.slice(0, 2).join("; ")] : []),
      ...(t.flags.length ? [t.flags.join(" · ")] : []),
      `${src}${upd}`,
    ],
    eventDate: t.lastUpdate,
    eventDateKind: "source_update",
    origin: t.inWorkspace ? "workspace" : "public",
    actions: [
      { label: "Open trial", href: t.recordUrl },
      { label: "ClinicalTrials.gov ↗", href: t.url },
    ],
    ...(t.inWorkspace
      ? {}
      : { save: { kind: "trial" as const, label: "Save to workspace", payload: { nctId: t.nctId } } }),
  };
}

function summariseTrials(p: ParsedQuery, trials: TrialSearchResult[]): string {
  if (!trials.length) return "";
  const subject =
    [...p.assets, ...p.biomarkers].slice(0, 2).join(" / ") ||
    p.companies[0] ||
    p.indications[0] ||
    "your query";
  const recruiting = trials.filter((t) => t.status === "recruiting").length;
  const inWs = trials.filter((t) => t.inWorkspace).length;
  const newest = trials
    .map((t) => t.lastUpdate)
    .filter(Boolean)
    .sort()
    .pop();
  const parts = [
    `${trials.length} trial${trials.length === 1 ? "" : "s"} for ${subject}`,
    p.indications[0] ? `in ${p.indications[0]}` : "",
    recruiting ? `— ${recruiting} recruiting` : "",
  ].filter(Boolean);
  let s = parts.join(" ") + ".";
  if (newest) s += ` Most recent ClinicalTrials.gov update ${newest}.`;
  if (inWs) s += ` ${inWs} already in your workspace.`;
  else s += ` Save any result to add it to your workspace.`;
  return s;
}

function searchSuggestions(p: ParsedQuery): string[] {
  const b = p.biomarkers[0];
  const a = p.assets[0];
  const c = p.companies[0];
  const ind = p.indications[0];
  const out: string[] = [];
  if (b) {
    out.push(`${b} phase 3 trials`);
    out.push(ind ? `${b} ${ind} trials recruiting` : `${b} recruiting trials`);
    out.push(`what changed in ${b} this week`);
    if (c) out.push(`${c} ${b} trials`);
    else out.push(`companies with ${b} programs`);
  } else if (a) {
    out.push(`${a} trials`, `${a} mechanism of action`, `what changed for ${a} this week`);
  } else if (c) {
    out.push(`${c} oncology trials`, `${c} recruiting trials`, `${c} pipeline updates`);
  }
  return out.slice(0, 4);
}

async function buildSearchResponse(
  input: AskPipelineInput,
  parsed: ParsedQuery,
  search: SearchResult | null,
  deps: {
    client: ReturnType<typeof anthropic>;
    baseMeta: AskResponse["meta"];
    retrieval: { tool: string; count: number }[];
  },
): Promise<AskResponse> {
  const { client, baseMeta } = deps;
  const trials = search?.trials ?? [];
  const companies = search?.companies ?? [];
  const signals = search?.signals ?? [];
  const people = search?.people ?? [];
  const total = trials.length + companies.length + signals.length + people.length;

  // Cards, grouped & ranked: trials, then companies, then signals, then people.
  const cards: AskCard[] = [
    ...trials.map(trialCard),
    ...companies.map(
      (c): AskCard => ({
        kind: "company",
        title: c.name,
        subtitle: [c.type, c.ticker ? `(${c.ticker})` : null].filter(Boolean).join(" "),
        origin: "workspace",
        actions: [{ label: "Open account", href: c.recordUrl }],
      }),
    ),
    ...signals.map(
      (s): AskCard => ({
        kind: "signal",
        title: s.headline,
        subtitle: s.summary?.slice(0, 180),
        why: [s.company, s.signalType].filter(Boolean) as string[],
        eventDate: s.eventDate,
        eventDateKind: "detected",
        origin: "workspace",
        actions: [{ label: "Open", href: s.recordUrl }],
      }),
    ),
    ...people.map(
      (pn): AskCard => ({
        kind: "person",
        title: pn.name,
        subtitle: [pn.title, pn.company].filter(Boolean).join(" · "),
        why: pn.role ? [pn.role] : undefined,
        origin: "workspace",
        actions: [{ label: "Open", href: pn.recordUrl }],
      }),
    ),
  ];

  // A Monitor action when there's a clear topic to watch.
  const watchName =
    parsed.assets[0] || parsed.biomarkers[0] || parsed.companies[0] || parsed.indications[0] || null;
  if (watchName) {
    cards.push({
      kind: "monitor",
      title: `Monitor "${watchName}"`,
      subtitle: "Track new and changed ClinicalTrials.gov records for this on a daily refresh.",
      origin: "public",
      actions: [],
      save: {
        kind: "watchlist",
        label: "Monitor this",
        payload: {
          name: watchName.slice(0, 60),
          terms: [...parsed.biomarkers, ...parsed.assets, ...parsed.companies].join(","),
          conditions: parsed.indications.join(","),
        },
      },
    });
  }

  // Answer: a deterministic one-liner, optionally expanded by a SHORT grounded
  // synthesis (no web search — fast). Never fabricated when the model is absent.
  let answer = summariseTrials(parsed, trials);
  if (!answer && total > 0) {
    const kinds = [
      companies.length ? `${companies.length} compan${companies.length === 1 ? "y" : "ies"}` : "",
      signals.length ? `${signals.length} signal${signals.length === 1 ? "" : "s"}` : "",
      people.length ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "",
    ].filter(Boolean);
    answer = `Found ${kinds.join(", ")} for "${parsed.raw}" (below).`;
  }
  if (!answer) {
    answer =
      `No trials, companies, signals or people match "${parsed.raw}" in your workspace or on ClinicalTrials.gov` +
      (search?.meta.ctgovError ? ` (ClinicalTrials.gov: ${search.meta.ctgovError})` : "") +
      `. Try a gene ("KRAS G12D"), a drug ("RMC-6236"), a sponsor, or an NCT id.`;
  }

  let synthesis: SynthesisState = "skipped";
  let requestId: string | null = null;
  let model: string | null = null;
  if (client && total > 0) {
    try {
      const rows = {
        trials: trials.slice(0, 10).map((t) => ({
          nctId: t.nctId,
          title: t.title,
          phase: t.phaseLabel,
          status: t.statusLabel,
          sponsor: t.sponsor,
          drugs: t.interventions,
          conditions: t.conditions,
          biomarkers: t.biomarkers,
          lastUpdate: t.lastUpdate,
          source: t.source,
        })),
        signals: signals.slice(0, 5).map((s) => ({ headline: s.headline, date: s.eventDate })),
        companies: companies.slice(0, 5).map((c) => c.name),
      };
      const rich = await client.generateTextRich({
        system:
          "You are Ask newwin. In 2-4 plain-prose sentences, summarise these STRUCTURED search results for an oncology BD user. " +
          "Only use the rows given — no outside knowledge, no invented drugs/dates. No markdown. " +
          "Note phase spread, how many are recruiting, notable sponsors, and the most recent update date.",
        prompt: `QUERY: ${input.query}\n\nRESULTS:\n${JSON.stringify(rows, null, 1)}`,
        maxTokens: 500,
        temperature: 0.2,
        signal: input.signal,
        timeoutMs: 15_000,
      });
      const text = stripMarkdown(rich.text.trim());
      if (text.length >= 40) {
        answer = text;
        synthesis = "ok";
      }
      requestId = rich.meta.requestId;
      model = rich.meta.model;
    } catch (err) {
      synthesis = "failed";
      baseMeta.synthesisError = (err as Error)?.message?.slice(0, 160) ?? "synthesis failed";
      // keep the deterministic answer
    }
  }

  const sources: AskSource[] = [
    ...trials.slice(0, 10).map(
      (t): AskSource => ({
        kind: "external",
        label: `${t.nctId} — ClinicalTrials.gov${t.lastUpdate ? ` (updated ${t.lastUpdate})` : ""}`,
        url: t.url,
        date: t.lastUpdate,
      }),
    ),
    ...signals.slice(0, 5).map(
      (s): AskSource => ({ kind: "workspace_record", label: s.headline, url: s.recordUrl, date: s.eventDate }),
    ),
  ];

  const wsTrialCount = trials.filter((t) => t.inWorkspace).length;
  const workspaceNote =
    total === 0
      ? null
      : wsTrialCount
        ? `${wsTrialCount} of these ${wsTrialCount === 1 ? "trial is" : "trials are"} already in your workspace; the rest are live from ClinicalTrials.gov.`
        : `These are live from ClinicalTrials.gov and your workspace — save any to keep them.`;

  return {
    status: total > 0 ? "ok" : "no_results",
    mode: synthesis === "ok" ? "database+ai" : "database",
    answer,
    workspaceNote,
    cards,
    sources,
    suggestions: searchSuggestions(parsed),
    conversationId: input.conversationId ?? null,
    meta: {
      ...baseMeta,
      intent: "search",
      model,
      requestId,
      researchRequestId: null,
      usage: null,
      synthesis,
    },
  };
}

/**
 * The answer panel renders plain text (whitespace-pre-wrap). The model is told
 * not to use markdown; this strips any that slips through so headings/bullets/
 * bold never show up as literal '#'/'*' characters in the UI.
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // ATX headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s{0,3}([-*+])\s+/gm, "• ") // bullet markers → a plain bullet
    .replace(/^\s{0,3}(\d+)\.\s+/gm, "$1. ") // keep numbered lists readable
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1$2") // italics
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
