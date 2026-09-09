import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/tenant";
import { llmStatus } from "@/lib/llm/status";
import { AnthropicError } from "@/lib/llm";
import { runAsk, unavailableResponse } from "@/lib/ask/pipeline";
import { checkAndIncrement } from "@/lib/ask/rate-limit";
import {
  listConversations,
  loadConversation,
  recordTurn,
} from "@/lib/ask/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ASK_LIMIT_PER_MIN = 20;
const ASK_TENANT_LIMIT_PER_MIN = 120;

/** POST — ask a question. */
export async function POST(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) {
    return NextResponse.json(
      { code: "unauthenticated", error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }
  const { tenant, user } = auth;

  let body: {
    q?: string;
    path?: string;
    conversationId?: string;
    previousCards?: { title: string; href: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request", error: "Invalid JSON body." }, { status: 400 });
  }

  const query = String(body.q ?? "").trim().slice(0, 1000);
  if (!query) {
    return NextResponse.json(
      { code: "empty", error: "Ask a question — a company, an NCT id, a biomarker, or what changed this week." },
      { status: 400 },
    );
  }

  // Shared, cross-instance rate limits (per user + per workspace).
  const [byUser, byTenant] = await Promise.all([
    checkAndIncrement(`ask:user:${user.id}`, ASK_LIMIT_PER_MIN, 60_000),
    checkAndIncrement(`ask:tenant:${tenant.id}`, ASK_TENANT_LIMIT_PER_MIN, 60_000),
  ]);
  if (!byUser.ok || !byTenant.ok) {
    const r = !byUser.ok ? byUser : byTenant;
    return NextResponse.json(
      { code: "rate_limited", error: "You're asking a lot, fast. Try again in a minute.", resetAt: r.resetAt },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const status = llmStatus();

  // Page context (never overrides an explicit question).
  const path = String(body.path ?? "/");
  const acct = /\/accounts\/([0-9a-f-]{36})/.exec(path);
  const trial = /\/trials\/(NCT\d{8})/i.exec(path);
  let contextCompany: { id: string; name: string } | null = null;
  if (acct) {
    const { getDb } = await import("@/db");
    const { organizations } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = await getDb();
    const [o] = await db
      .select({ id: organizations.id, name: organizations.canonicalName })
      .from(organizations)
      .where(and(eq(organizations.id, acct[1]), eq(organizations.tenantId, tenant.id)))
      .limit(1);
    if (o) contextCompany = o;
  }

  // Prior turns for follow-ups ("only phase 2", "the second result").
  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (body.conversationId) {
    const turns = await loadConversation(body.conversationId, tenant.id, user.id);
    if (turns === null) {
      // Not the caller's conversation — ignore it, start fresh.
      body.conversationId = undefined;
    } else {
      history = turns.map((t) => ({ role: t.role, content: t.content }));
    }
  }

  const ctlAbort = new AbortController();
  req.signal?.addEventListener("abort", () => ctlAbort.abort(), { once: true });

  try {
    const response = await runAsk({
      query,
      ctx: { tenantId: tenant.id, userId: user.id },
      page: {
        contextCompany,
        contextNctId: trial ? trial[1].toUpperCase() : null,
        history,
      },
      previousCards: Array.isArray(body.previousCards) ? body.previousCards.slice(0, 12) : undefined,
      conversationId: body.conversationId ?? null,
      signal: ctlAbort.signal,
    });

    // Persist the turn (auth already checked; recordTurn re-verifies ownership).
    const conversationId = await recordTurn({
      tenantId: tenant.id,
      userId: user.id,
      conversationId: body.conversationId ?? null,
      question: query,
      response,
    });

    return NextResponse.json({ ...response, conversationId });
  } catch (err) {
    if (err instanceof AnthropicError) {
      if (err.status === 499) {
        return NextResponse.json({ code: "cancelled", error: "Request cancelled." }, { status: 499 });
      }
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json(
          unavailableResponse("the AI provider rejected the API key"),
          { status: 200 },
        );
      }
      if (err.status === 429) {
        return NextResponse.json(
          { code: "ai_busy", error: "The AI provider is rate-limiting us. Try again shortly." },
          { status: 429 },
        );
      }
      // Provider/network failure — degrade to unavailable, not a crash.
      return NextResponse.json(unavailableResponse("the AI provider is temporarily unreachable"), {
        status: 200,
      });
    }
    console.error("[ask] pipeline error", (err as Error)?.message, {
      aiConfigured: status.configured,
    });
    return NextResponse.json(
      { code: "server_error", error: "Ask newwin hit an unexpected error. Database search still works." },
      { status: 500 },
    );
  }
}

/** GET — list conversations, or load one with `?conversationId=`. */
export async function GET(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) {
    return NextResponse.json(
      { code: "unauthenticated", error: "Please sign in again." },
      { status: 401 },
    );
  }
  const { tenant, user } = auth;
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");

  if (conversationId) {
    const turns = await loadConversation(conversationId, tenant.id, user.id);
    if (turns === null) {
      return NextResponse.json({ code: "not_found", error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json({ conversationId, turns });
  }

  const conversations = await listConversations(tenant.id, user.id);
  return NextResponse.json({ conversations });
}
