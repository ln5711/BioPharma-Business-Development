import "server-only";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  commercialSignals,
  interactions,
  organizations,
  recommendationFeedback,
  signalSources,
  tasks,
  trialChanges,
  trials,
  workspaceItems,
  workspaces,
} from "@/db/schema";
import { inArray } from "drizzle-orm";
import { signalMeta } from "@/lib/signals/taxonomy";
import { matchesPriority, priorityMatcher, type UserPrefs } from "@/lib/user-prefs";

export type RecType =
  | "signal"
  | "account"
  | "trial"
  | "follow_up"
  | "workspace"
  | "task";

export interface Recommendation {
  /**
   * Stable, human-readable identity: `"<entityType>:<entityId>"`. Used both as
   * the dedupe key (one card per underlying entity) AND the feedback key, so
   * dismiss/defer/complete is deterministic and survives re-ranking. NOT a hash.
   */
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

function daysAgo(d: Date | string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function fmtDate(d: Date | string | null): string | null {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
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
  // Paused priorities do not match anything.
  const activePriorities = prefs.priorities
    .filter((p) => !p.paused)
    .map((p) => ({ priority: p, matcher: priorityMatcher(p) }));
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

  // Primary source per signal (for evidence + link in the explanation).
  const sigIds = sigRows.map((r) => r.s.id);
  const sourceBySignal = new Map<
    string,
    { title: string | null; url: string | null; publishedAt: Date | null; type: string }
  >();
  if (sigIds.length) {
    const srcRows = await db
      .select()
      .from(signalSources)
      .where(inArray(signalSources.signalId, sigIds))
      .orderBy(desc(signalSources.publishedAt));
    for (const s of srcRows) {
      if (!sourceBySignal.has(s.signalId)) {
        sourceBySignal.set(s.signalId, {
          title: s.title,
          url: s.url,
          publishedAt: s.publishedAt,
          type: s.sourceType,
        });
      }
    }
  }

  const usedOrgs = new Set<string>();
  const usedSignals = new Set<string>();

  // 1 — signals: one card per signal, whether it matched a priority or simply
  // scored highly. Explicit `signal:<id>` key → natural dedupe + stable feedback.
  for (const row of sigRows) {
    if (usedSignals.has(row.s.id)) continue;

    const hay = [
      row.s.headline,
      row.s.factSummary,
      row.orgName ?? "",
      (row.conditions ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    const hit = activePriorities.find((p) => matchesPriority(hay, p.matcher));
    const highScore = (row.s.opportunityScore ?? 0) >= 70;
    if (!hit && !highScore) continue;

    const key = `signal:${row.s.id}`;
    if (suppressed.has(key)) continue;

    const meta = signalMeta(row.s.signalType);
    const src = sourceBySignal.get(row.s.id);
    const sourceLabel = src
      ? `${src.title ?? src.type}${
          src.publishedAt ? ` (${fmtDate(src.publishedAt)})` : ""
        }`
      : row.s.sourceDate
        ? `reported ${fmtDate(row.s.sourceDate)}`
        : null;
    const detected = fmtDate(row.s.detectedAt);

    const why = [
      hit ? `Matches your priority "${hit.priority.text}".` : null,
      highScore ? `Opportunity score ${row.s.opportunityScore} — above your review threshold.` : null,
      `${row.orgName ?? "This account"} · ${meta.label.toLowerCase()}${
        sourceLabel ? ` · source: ${sourceLabel}` : ""
      }${detected ? ` · detected ${detected}` : ""}`,
      row.s.whyNow ?? row.s.whyItMatters ?? "",
    ].filter((s): s is string => Boolean(s));

    out.push({
      key,
      type: "signal",
      title: `${meta.label} — ${row.orgName ?? "Unresolved sponsor"}`,
      reason:
        row.s.whyItMatters ??
        row.s.commercialInterpretation ??
        (hit ? "A development that maps to one of your priorities." : "High opportunity score."),
      nextStep:
        row.s.recommendedAction ??
        `Review the signal and identify the ${
          meta.personas[0]?.replace(/_/g, " ") ?? "right"
        } contact.`,
      why,
      score: (row.s.opportunityScore ?? 40) + (hit ? 12 : 4),
      entityLabel: row.orgName,
      action: {
        label: "Review signal",
        href: row.nct ? `/trials/${row.nct}` : `/intelligence?signal=${row.s.id}`,
      },
    });
    usedSignals.add(row.s.id);
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
    const key = `account:${a.id}`;
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
    const key = `task:${t.id}`;
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
    const key = `workspace:${w.id}`;
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
    const key = `trialchange:${c.id}`;
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

  // Rank, then dedupe by the explicit entity key (`<type>:<id>`) — never by a
  // hash prefix or a rendered title. Keep the highest-scoring card per entity.
  const byKey = new Map<string, Recommendation>();
  for (const r of out.sort((a, b) => b.score - a.score)) {
    if (!byKey.has(r.key)) byKey.set(r.key, r);
  }
  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 6)
    .map(
      (r, i) =>
        ({
          ...r,
          score: Math.max(1, Math.min(100, Math.round(r.score))),
          rank: i + 1,
        }) as Recommendation,
    );
}
