import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  commercialSignals,
  organizations,
  people,
  trialChanges,
  trials,
} from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { getUserPrefs, RANGE_MS } from "@/lib/user-prefs";
import { getRecommendations } from "@/lib/recommendations/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AskCard {
  kind: string;
  title: string;
  subtitle?: string;
  why?: string[];
  actions: { label: string; href: string }[];
}

/**
 * Ask newwin — deterministic, context-aware. Resolves entity context from the
 * caller's path, detects a coarse intent, and returns actionable cards.
 */
export async function POST(req: Request) {
  const { q = "", path = "/" } = (await req.json().catch(() => ({}))) as {
    q?: string;
    path?: string;
  };
  const query = String(q).trim();
  if (!query) return NextResponse.json({ answer: "Ask me anything about your territory.", cards: [] });

  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const lower = query.toLowerCase();

  // ── page context ─────────────────────────────────────────────────────────
  let contextOrg: { id: string; name: string } | null = null;
  let contextTrial: string | null = null;
  const acctMatch = /\/accounts\/([0-9a-f-]{36})/.exec(path ?? "");
  const trialMatch = /\/trials\/(NCT\d{8})/i.exec(path ?? "");
  if (acctMatch) {
    const [o] = await db
      .select({ id: organizations.id, name: organizations.canonicalName })
      .from(organizations)
      .where(eq(organizations.id, acctMatch[1]))
      .limit(1);
    if (o) contextOrg = o;
  }
  if (trialMatch) contextTrial = trialMatch[1].toUpperCase();

  const cards: AskCard[] = [];
  let answer = "";

  // ── intent: what should I focus on / what changed ───────────────────────
  if (/focus|what should i (do|look)|priorit|today/.test(lower) || /what changed|overnight|this week/.test(lower)) {
    const prefs = await getUserPrefs(user.id);
    const range = /week/.test(lower) ? "7d" : prefs.homeRange;
    const recs = await getRecommendations({
      tenantId: tenant.id,
      userId: user.id,
      prefs,
      sinceMs: RANGE_MS[range as keyof typeof RANGE_MS] ?? RANGE_MS["24h"],
      limit: 4,
    });
    answer =
      recs.length > 0
        ? `Here's what I'd work through first (${range}).`
        : "Nothing crossed the threshold in that window. The feed is quiet.";
    for (const r of recs) {
      cards.push({
        kind: r.type.replace("_", " "),
        title: r.title,
        subtitle: r.reason,
        why: r.why,
        actions: [{ label: r.action.label, href: r.action.href }],
      });
    }
    return NextResponse.json({ answer, cards });
  }

  // ── intent: who should I contact ───────────────────────────────────────
  if (/who (should i|do i|to) (contact|reach|email)|contact at|reach out/.test(lower)) {
    const orgName = contextOrg?.name ?? extractCompany(query);
    let rows: { id: string; name: string; title: string | null; fn: string; orgId: string | null; orgName: string | null }[] = [];
    if (orgName || contextOrg) {
      rows = await db
        .select({
          id: people.id,
          name: people.name,
          title: people.title,
          fn: people.function,
          orgId: people.organizationId,
          orgName: organizations.canonicalName,
        })
        .from(people)
        .leftJoin(organizations, eq(organizations.id, people.organizationId))
        .where(
          and(
            eq(people.tenantId, tenant.id),
            contextOrg
              ? eq(people.organizationId, contextOrg.id)
              : ilike(organizations.canonicalName, `%${orgName}%`),
          ),
        )
        .orderBy(desc(people.relevanceScore))
        .limit(3);
    }
    if (rows.length === 0) {
      answer = contextOrg
        ? `No stakeholders are mapped for ${contextOrg.name} yet. Open the account to add them.`
        : "No matching contacts are mapped yet. Contact intelligence fills in as publications and trial records are ingested.";
      if (contextOrg) cards.push({ kind: "account", title: contextOrg.name, actions: [{ label: "Open account", href: `/accounts/${contextOrg.id}` }] });
    } else {
      answer = `Best contacts${contextOrg ? ` at ${contextOrg.name}` : ""}, ranked by relevance:`;
      for (const p of rows) {
        cards.push({
          kind: "recommended contact",
          title: p.name,
          subtitle: [p.title, p.orgName].filter(Boolean).join(" · "),
          why: [`Function: ${p.fn.replace(/_/g, " ")}`, "Ranked on functional relevance + evidence"],
          actions: [
            { label: "Draft outreach", href: `/outreach?person=${p.id}` },
            ...(p.orgId ? [{ label: "Open account", href: `/accounts/${p.orgId}` }] : []),
          ],
        });
      }
    }
    return NextResponse.json({ answer, cards });
  }

  // ── intent: overdue / show outreach ───────────────────────────────────
  if (/overdue|follow[- ]?up|outreach/.test(lower)) {
    answer = "Your outreach queue — recommended, drafts and follow-ups.";
    cards.push({ kind: "outreach", title: "Open the outreach queue", actions: [{ label: "Go to Outreach", href: "/outreach" }] });
    return NextResponse.json({ answer, cards });
  }

  // ── intent: trials changed ───────────────────────────────────────────
  if (/trial.*(chang|amend|updat)|what trials/.test(lower)) {
    const rows = await db
      .select({ c: trialChanges, nct: trials.nctId, title: trials.title })
      .from(trialChanges)
      .leftJoin(trials, eq(trials.id, trialChanges.trialId))
      .where(and(eq(trialChanges.tenantId, tenant.id), gte(trialChanges.detectedAt, new Date(Date.now() - 7 * 864e5))))
      .orderBy(desc(trialChanges.commercialRelevance))
      .limit(5);
    answer = rows.length ? "Trial changes in the last 7 days:" : "No trial changes recorded in the last 7 days.";
    for (const r of rows) {
      if (!r.nct) continue;
      cards.push({
        kind: "trial change",
        title: r.title ?? r.nct,
        subtitle: r.c.summary,
        actions: [{ label: "Open trial", href: `/trials/${r.nct}` }],
      });
    }
    return NextResponse.json({ answer, cards });
  }

  // ── fallback: keyword search across signals, accounts, trials ──────────
  const term = `%${query.replace(/[%_]/g, "")}%`;
  const sigs = await db
    .select({
      s: commercialSignals,
      orgName: organizations.canonicalName,
      nct: trials.nctId,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(
      and(
        eq(commercialSignals.tenantId, tenant.id),
        ne(commercialSignals.status, "dismissed"),
        or(
          ilike(commercialSignals.headline, term),
          ilike(commercialSignals.factSummary, term),
          ilike(organizations.canonicalName, term),
        ),
      ),
    )
    .orderBy(desc(commercialSignals.opportunityScore))
    .limit(4);

  if (sigs.length > 0) {
    answer = `${sigs.length} signal${sigs.length === 1 ? "" : "s"} match "${query}".`;
    for (const row of sigs) {
      cards.push({
        kind: "signal",
        title: row.s.headline,
        subtitle: [row.orgName, `score ${row.s.opportunityScore}`].filter(Boolean).join(" · "),
        why: [row.s.whyNow ?? ""].filter(Boolean),
        actions: [
          { label: "Review", href: row.nct ? `/trials/${row.nct}` : `/intelligence?signal=${row.s.id}` },
        ],
      });
    }
  } else {
    answer = `Nothing in the mapped universe matches "${query}" yet. Try a company, pathway or "what should I focus on today?".`;
  }
  return NextResponse.json({ answer, cards });
}

function extractCompany(q: string): string {
  const m = /(?:at|for|with)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/.exec(q);
  return (m?.[1] ?? "").trim();
}
