import { NextResponse } from "next/server";
import { anthropic } from "@/lib/llm";
import { llmStatus } from "@/lib/llm/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deployed Anthropic verification. Makes ONE real text call and ONE real
 * web_search call, and returns the non-sensitive telemetry only —
 * HTTP outcome, request id, model, token usage, stop reason, and the citation
 * URLs. Never returns the API key or any private content.
 *
 * Preview / non-production only. On Production it returns 404 so it can't be
 * used to probe billing there.
 */
export async function GET(req: Request) {
  const isPreview =
    process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
  if (!isPreview) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const status = llmStatus();
  const client = anthropic();
  if (!client) {
    return NextResponse.json(
      { ok: false, configured: false, reason: status.reason, llm: status },
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const runWeb = url.searchParams.get("web") !== "0";
  const runPipeline = url.searchParams.get("pipeline") === "1";
  // Optional: exercise runAsk() with an arbitrary query (the acceptance-test
  // scenario is a BARE query like "KRAS" — no "search the web" prefix).
  const pipelineQuery = url.searchParams.get("q")?.slice(0, 200) || null;

  const out: Record<string, unknown> = { ok: true, llm: status };

  // 0 — full runAsk() pipeline for an explicit web-search query, against a
  // workspace with ZERO relevant records (the exact reported scenario). Proves
  // the web summary is the primary answer, not the no-results message.
  if (runPipeline || pipelineQuery) {
    try {
      const { runAsk } = await import("@/lib/ask/pipeline");
      const { getDb } = await import("@/db");
      const { tenants, organizationMembers } = await import("@/db/schema");
      const { like, eq } = await import("drizzle-orm");
      const db = await getDb();
      const [t] = await db
        .select()
        .from(tenants)
        .where(like(tenants.slug, "preview-verify-%"))
        .limit(1);
      const [m] = t
        ? await db
            .select()
            .from(organizationMembers)
            .where(eq(organizationMembers.tenantId, t.id))
            .limit(1)
        : [undefined];

      if (!t || !m) {
        out.pipeline = { skipped: "no preview-verify workspace found" };
      } else {
        const query =
          pipelineQuery ??
          "Search the web for the latest FDA news on Novartis oncology developments";
        const r = await runAsk({
          query,
          ctx: { tenantId: t.id, userId: m.userId },
          page: {},
        });
        out.pipeline = {
          query,
          intent: r.meta.intent,
          intentSource: r.meta.intentSource,
          status: r.status,
          mode: r.mode,
          synthesis: r.meta.synthesis,
          synthesisError: r.meta.synthesisError,
          retrieval: r.meta.retrieval,
          researchRequestId: r.meta.researchRequestId,
          finalRequestId: r.meta.requestId,
          usage: r.meta.usage,
          answerChars: r.answer.length,
          answerLooksLikeNoResults:
            /no account called|is in your workspace|add it as a monitored company|ask me to search external|no results|nothing in your workspace/i.test(
              r.answer,
            ),
          answerPreview: r.answer.slice(0, 500),
          suggestions: r.suggestions,
          workspaceNote: r.workspaceNote,
          publicCardCount: r.cards.filter((c) => c.origin === "public").length,
          workspaceCardCount: r.cards.filter((c) => c.origin === "workspace").length,
          cardsWithSaveAction: r.cards.filter((c) => !!c.save).map((c) => c.save!.kind),
          externalCitationCount: r.sources.filter((s) => s.kind === "external").length,
        };
      }
    } catch (e) {
      out.ok = false;
      out.pipeline = { error: (e as Error)?.message?.slice(0, 240) };
    }
  }

  // 1 — plain text call
  try {
    const t0 = Date.now();
    const r = await client.generateTextRich({
      system: "Reply with exactly: OK",
      prompt: "Connectivity check. Reply with OK.",
      temperature: 0,
      timeoutMs: 20_000,
    });
    out.text = {
      httpOutcome: "success",
      model: r.meta.model,
      requestId: r.meta.requestId,
      stopReason: r.meta.stopReason,
      usage: r.meta.usage,
      latencyMs: Date.now() - t0,
      replyChars: r.text.trim().length,
    };
  } catch (e) {
    const err = e as { name?: string; status?: number; requestId?: string; message?: string };
    out.ok = false;
    out.text = {
      httpOutcome: "error",
      errorName: err?.name ?? "Error",
      status: err?.status ?? null,
      requestId: err?.requestId ?? null,
      message: (err?.message ?? "").slice(0, 200),
    };
  }

  // 2 — web_search call
  if (runWeb) {
    try {
      const t0 = Date.now();
      const r = await client.research({
        system:
          "Use the web_search tool to find current, dated developments. Write a short cited briefing.",
        prompt: "Latest FDA news on KRAS G12C inhibitors. Return a dated, source-attributed summary.",
        maxUses: 3,
        timeoutMs: 55_000,
      });
      out.webSearch = {
        httpOutcome: "success",
        model: r.meta.model,
        requestId: r.meta.requestId,
        stopReason: r.meta.stopReason,
        usage: r.meta.usage,
        serverToolUse: r.meta.serverToolUse ?? null,
        latencyMs: Date.now() - t0,
        summaryChars: r.text.trim().length,
        citationCount: r.citations.length,
        citationHosts: [
          ...new Set(
            r.citations
              .map((c) => {
                try {
                  return new URL(c.url).hostname.replace(/^www\./, "");
                } catch {
                  return null;
                }
              })
              .filter(Boolean),
          ),
        ].slice(0, 12),
      };
    } catch (e) {
      const err = e as { name?: string; status?: number; requestId?: string; message?: string };
      out.ok = false;
      out.webSearch = {
        httpOutcome: "error",
        errorName: err?.name ?? "Error",
        status: err?.status ?? null,
        requestId: err?.requestId ?? null,
        message: (err?.message ?? "").slice(0, 200),
      };
    }
  }

  return NextResponse.json(out);
}
