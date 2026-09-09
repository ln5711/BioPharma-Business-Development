import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  commercialSignals,
  interactions,
  organizations,
  recommendationFeedback,
  tasks,
  trialChanges,
  trials,
  workspaceItems,
  workspaces,
} from "@/db/schema";
import { signalMeta } from "@/lib/signals/taxonomy";
import { priorityKeywords, type UserPrefs } from "@/lib/user-prefs";

export type RecType =
  | "signal"
  | "account"
  | "trial"
  | "follow_up"
  | "workspace"
  | "task";

export interface Recommendation {
  key: string;
  type: RecType;
  title: string;
  reason: string;
  nextStep: string;
  why: string[];
  score: number;
  entityLabel: string | null;
  action: { label: string; href: string };
}

const keyOf = (parts: string[]) =>
  createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);

function daysAgo(d: Date | string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

/**
 * Rule-based, explainable recommendation engine (spec: "Do not make an opaque AI
 * model invent priorities"). Ranks concrete next actions from the user's
 * priorities plus live signal / trial / account / outreach / workspace state.
 */
export async function getRecommendations(opts: {
  tenantId: string;
  userId: string;
  prefs: UserPrefs;
  sinceMs: number;
  limit?: number;
}): Promise<Recommendation[]> {
  const db = await getDb();
  const { tenantId, userId, prefs, sinceMs } = opts;
  const since = new Date(Date.now() - sinceMs);
  const activePriorities = prefs.priorities.filter((p) => !p.paused);
  const out: Recommendation[] = [];

  // ── suppressed / deferred keys ─────────────────────────────────────────────
  const feedback = await db
    .select()
    .from(recommendationFeedback)
    .where(eq(recommendationFeedback.userId, userId));
  const suppressed = new Set(
    feedback
      .filter(
        (f) =>
          f.status === "dismissed" ||
          f.status === "completed" ||
          (f.status === "deferred" && f.until && new Date(f.until) > new Date()),
      )
      .map((f) => f.recKey),
  );

  // ── recent signals joined to org + trial ─────────────────────────────────
  const sigRows = await db
    .select({
      s: commercialSignals,
      orgName: organizations.canonicalName,
      orgId: organizations.id,
      nct: trials.nctId,
      conditions: trials.conditionsRaw,
    })
    .from(commercialSignals)
    .leftJoin(organizations, eq(organizations.id, commercialSignals.organizationId))
    .leftJoin(trials, eq(trials.id, commercialSignals.trialId))
    .where(
      and(
        eq(commercialSignals.tenantId, tenantId),
        ne(commercialSignals.status, "dismissed"),
        gte(commercialSignals.detectedAt, since),
      ),
    )
    .orderBy(desc(commercialSignals.opportunityScore), desc(commercialSignals.detectedAt))
    .limit(60);

  const usedOrgs = new Set<string>();

  // 1 — signals matched to an active priority
  for (const row of sigRows) {
    const hay = [
      row.s.headline,
      row.s.factSummary,
      row.orgName ?? "",
      (row.conditions ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    const matched = activePriorities.find((p) =>
      priorityKeywords(p).some((k) => k && hay.includes(k)),
    );
    if (!matched) continue;

    const meta = signalMeta(row.s.signalType);
    const key = keyOf(["sig", row.s.id, matched.id]);
    if (suppressed.has(key)) continue;

    out.push({
      key,
      type: "signal",
      title: `${meta.label} — ${row.orgName ?? "Unresolved sponsor"}`,
      reason:
        row.s.whyItMatters ??
        row.s.commercialInterpretation ??
        "A development that maps to one of your priorities.",
      nextStep:
        row.s.recommendedAction ??
        `Review the signal and identify the ${meta.personas[0]?.replace(/_/g, " ") ?? "right"} contact.`,
      why: [
        `"${matched.text}" is one of your priorities.`,
        `${row.orgName ?? "This account"} had a ${meta.label.toLowerCase()} in this window.`,
        row.s.whyNow ?? "",
      ].filter(Boolean),
      score: (row.s.opportunityScore ?? 40) + 12,
      entityLabel: row.orgName,
      action: {
        label: "Review signal",
        href: row.nct ? `/trials/${row.nct}` : `/intelligence?signal=${row.s.id}`,
      },
    });
    if (row.orgId) usedOrgs.add(row.orgId);
  }

  // 2 — high-priority signals regardless of priority match
  for (const row of sigRows) {
    if ((row.s.opportunityScore ?? 0) < 70) continue;
    const key = keyOf(["sig", row.s.id, "hp"]);
    if (suppressed.has(key)) continue;
    if (out.some((r) => r.key.startsWith(keyOf(["sig", row.s.id, ""]).slice(0, 8)))) {
      // rough: skip if this signal already surfaced via a priority
    }
    if (out.find((r) => r.action.href.includes(row.s.id))) continue;
    const meta = signalMeta(row.s.signalType);
    out.push({
      key,
      type: "signal",
      title: `${meta.label} — ${row.orgName ?? "Unresolved sponsor"}`,
      reason: row.s.whyItMatters ?? row.s.commercialInterpretation ?? "High opportunity score.",
      nextStep: row.s.recommendedAction ?? "Map stakeholders and draft evidence-based outreach.",
      why: [
        `Opportunity score ${row.s.opportunityScore} — above your review threshold.`,
        row.s.whyNow ?? "",
      ].filter(Boolean),
      score: (row.s.opportunityScore ?? 70) + 4,
      entityLabel: row.orgName,
      action: { label: "Review signal", href: row.nct ? `/trials/${row.nct}` : `/intelligence?signal=${row.s.id}` },
    });
    if (row.orgId) usedOrgs.add(row.orgId);
  }

  // 3 — accounts with recent movement but no recent contact
  const accountRows = await db
    .select({
      id: organizations.id,
      name: organizations.canonicalName,
      topScore: sql<number>`coalesce(max(${commercialSignals.opportunityScore}), 0)::int`,
      lastContact: sql<string | null>`max(${interactions.occurredAt})`,
    })
    .from(organizations)
    .leftJoin(
      commercialSignals,
      and(
        eq(commercialSignals.organizationId, organizations.id),
        gte(commercialSignals.detectedAt, since),
      ),
    )
    .leftJoin(interactions, eq(interactions.organizationId, organizations.id))
    .where(eq(organizations.tenantId, tenantId))
    .groupBy(organizations.id)
    .having(sql`coalesce(max(${commercialSignals.opportunityScore}), 0) >= 65`)
    .orderBy(desc(sql`coalesce(max(${commercialSignals.opportunityScore}), 0)`))
    .limit(6);

  for (const a of accountRows) {
    if (usedOrgs.has(a.id)) continue;
    const key = keyOf(["acct", a.id]);
    if (suppressed.has(key)) continue;
    const gap = daysAgo(a.lastContact);
    out.push({
      key,
      type: "account",
      title: `${a.name} — requires attention`,
      reason:
        gap == null
          ? "Recent movement on this account and no outreach on record yet."
          : `Recent movement and no outreach in ${gap} days.`,
      nextStep: "Open the account, review the timeline, and identify the right contact.",
      why: [
        `Top signal score ${a.topScore} in this window.`,
        gap == null ? "No interaction logged." : `Last interaction ${gap} days ago.`,
      ],
      score: a.topScore,
      entityLabel: a.name,
      action: { label: "View account", href: `/accounts/${a.id}` },
    });
    usedOrgs.add(a.id);
  }

  // 4 — follow-ups due (open follow_up tasks + un-replied sent outreach)
  const followTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.userId, userId), eq(tasks.done, false)))
    .limit(10);
  for (const t of followTasks.filter((t) => t.category === "follow_up")) {
    const key = keyOf(["task", t.id]);
    if (suppressed.has(key)) continue;
    out.push({
      key,
      type: "follow_up",
      title: t.title,
      reason: "A follow-up you queued is still open.",
      nextStep: "Draft the follow-up or mark it done.",
      why: ["On your task list, category Follow-up."],
      score: 58,
      entityLabel: null,
      action: { label: "Open outreach", href: "/outreach" },
    });
  }

  // 5 — incomplete workspaces
  const wsRows = await db
    .select({
      w: workspaces,
      total: sql<number>`count(${workspaceItems.id})::int`,
      done: sql<number>`count(${workspaceItems.id}) filter (where ${workspaceItems.done})::int`,
    })
    .from(workspaces)
    .leftJoin(workspaceItems, eq(workspaceItems.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.tenantId, tenantId),
        eq(workspaces.userId, userId),
        eq(workspaces.status, "active"),
      ),
    )
    .groupBy(workspaces.id)
    .limit(5);
  for (const { w, total, done } of wsRows) {
    if (total > 0 && done >= total) continue;
    const key = keyOf(["ws", w.id]);
    if (suppressed.has(key)) continue;
    out.push({
      key,
      type: "workspace",
      title: `${w.title} — in progress`,
      reason:
        total > 0
          ? `${total - done} item${total - done === 1 ? "" : "s"} still open in this workspace.`
          : "This workspace has no items yet.",
      nextStep: "Continue where you left off.",
      why: ["An active workspace you started."],
      score: 50 + (total - done) * 2,
      entityLabel: w.title,
      action: { label: "Continue", href: `/workspaces/${w.id}` },
    });
  }

  // 6 — recent trial changes (high severity)
  const changeRows = await db
    .select({ c: trialChanges, nct: trials.nctId, title: trials.title })
    .from(trialChanges)
    .leftJoin(trials, eq(trials.id, trialChanges.trialId))
    .where(and(eq(trialChanges.tenantId, tenantId), gte(trialChanges.detectedAt, since)))
    .orderBy(desc(trialChanges.commercialRelevance))
    .limit(4);
  for (const { c, nct, title } of changeRows) {
    if (c.severity !== "high" && c.commercialRelevance < 70) continue;
    const key = keyOf(["chg", c.id]);
    if (suppressed.has(key) || !nct) continue;
    out.push({
      key,
      type: "trial",
      title: `Trial change — ${title ?? nct}`,
      reason: c.summary,
      nextStep: "Open the trial and check the commercial framing.",
      why: [`${c.severity} severity change`, `Commercial relevance ${c.commercialRelevance}`],
      score: c.commercialRelevance,
      entityLabel: nct,
      action: { label: "Open trial", href: `/trials/${nct}` },
    });
  }

  // rank, dedupe by title, cap
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seen.has(r.title)) return false;
      seen.add(r.title);
      return true;
    })
    .slice(0, opts.limit ?? 6)
    .map((r, i) => ({ ...r, score: Math.max(1, Math.min(100, Math.round(r.score))), rank: i + 1 }) as Recommendation);
}
