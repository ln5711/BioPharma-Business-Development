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
