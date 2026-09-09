import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, organizations, outreachDrafts } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { getUserPrefs, RANGE_MS } from "@/lib/user-prefs";
import { getRecommendations } from "@/lib/recommendations/engine";
import { loadDraftContext } from "@/lib/outreach/draft";
import { llmStatus } from "@/lib/llm/status";
import { PageHeader } from "@/components/ui/primitives";
import { formatRelativeDays } from "@/lib/utils";
import { LogOutreachForm } from "./log-outreach-form";
import { Composer } from "./composer";
import { deleteOutreachDraft } from "./draft-actions";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const prefs = await getUserPrefs(user.id);
  const sp = await searchParams;

  // Composer context from the deep link (all lookups tenant-scoped).
  const composeRequested = Boolean(sp.person || sp.trial || sp.signal || sp.account || sp.draft);
  let composer: React.ReactNode = null;
  if (composeRequested) {
    let existing: typeof outreachDrafts.$inferSelect | undefined;
    if (sp.draft) {
      [existing] = await db
        .select()
        .from(outreachDrafts)
        .where(
          and(
            eq(outreachDrafts.id, sp.draft),
            eq(outreachDrafts.tenantId, tenant.id),
            eq(outreachDrafts.userId, user.id),
          ),
        )
        .limit(1);
    }
    const ctx = await loadDraftContext(tenant.id, {
      personId: sp.person || existing?.personId || undefined,
      organizationId: sp.account || existing?.organizationId || undefined,
      nctId: sp.trial || undefined,
      signalId: sp.signal || undefined,
    });
    composer = (
      <section className="mb-9">
        <SectionLabel>Compose</SectionLabel>
        <div className="mt-3">
          <Composer
            draftId={existing?.id}
            personId={sp.person || existing?.personId || undefined}
            organizationId={ctx.organization?.id}
            nctId={sp.trial || undefined}
            signalId={sp.signal || undefined}
            recipientName={existing?.recipientName ?? ctx.person?.name ?? undefined}
            recipientEmail={existing?.recipientEmail ?? ctx.person?.email ?? undefined}
            subject={existing?.subject}
            body={existing?.body}
            evidenceRefs={existing?.evidenceRefs ?? ctx.evidenceRefs}
            aiConfigured={llmStatus().configured}
          />
        </div>
      </section>
    );
  }

  const [recs, logged, drafts] = await Promise.all([
    getRecommendations({
      tenantId: tenant.id,
      userId: user.id,
      prefs,
      sinceMs: RANGE_MS["7d"],
      limit: 8,
    }),
    db
      .select({ i: interactions, org: organizations.canonicalName })
      .from(interactions)
      .leftJoin(organizations, eq(organizations.id, interactions.organizationId))
      .where(and(eq(interactions.tenantId, tenant.id), eq(interactions.userId, user.id)))
      .orderBy(desc(interactions.occurredAt))
      .limit(30),
    db
      .select()
      .from(outreachDrafts)
      .where(
        and(
          eq(outreachDrafts.tenantId, tenant.id),
          eq(outreachDrafts.userId, user.id),
          eq(outreachDrafts.status, "draft"),
        ),
      )
      .orderBy(desc(outreachDrafts.updatedAt))
      .limit(20),
  ]);

  const outreachRecs = recs.filter((r) => r.type === "signal" || r.type === "follow_up" || r.type === "account");

  return (
    <div>
      <PageHeader
        eyebrow="Log & follow-ups"
        title="Outreach"
        description="Where you record outreach you've already sent and track the follow-ups it created. newwin does not send messages — no email, drip or CRM integration is connected."
      />

      {composer}

      <section className="mb-9">
        <SectionLabel>Drafts</SectionLabel>
        {drafts.length === 0 ? (
          <p className="mt-3 text-[13px] text-secondary">
            No saved drafts. Open a contact from an account or a recommendation and choose
            &ldquo;Draft outreach&rdquo;.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] text-primary">{d.subject || "(no subject)"}</div>
                  <div className="mt-0.5 text-[12px] text-secondary">
                    {d.recipientName ?? "no recipient"} ·{" "}
                    {d.generatedBy === "claude" ? "Claude draft" : "manual"} · updated{" "}
                    {formatRelativeDays(d.updatedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/outreach?draft=${d.id}`}
                    className="rounded-[8px] border border-default px-3 py-1.5 text-[12px] text-accent-fg"
                  >
                    Open
                  </Link>
                  <form action={deleteOutreachDraft}>
                    <input type="hidden" name="draftId" value={d.id} />
                    <button className="rounded-[8px] border border-default px-3 py-1.5 text-[12px] text-danger">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-9">
        <SectionLabel>Suggested next</SectionLabel>
        {outreachRecs.length === 0 ? (
          <p className="mt-3 text-[13px] text-secondary">No outreach suggested right now.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {outreachRecs.map((r) => (
              <div
                key={r.key}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                    {r.title}
                  </div>
                  <div className="mt-1 max-w-[70ch] text-[12.5px] text-secondary">{r.reason}</div>
                </div>
                <Link
                  href={r.action.href}
                  className="shrink-0 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
                  style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
                >
                  {r.action.label}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-9">
        <SectionLabel>Log outreach you&rsquo;ve already sent</SectionLabel>
        <LogOutreachForm />
      </section>

      <section>
        <SectionLabel>Logged</SectionLabel>
        {logged.length === 0 ? (
          <p className="mt-3 text-[13px] text-secondary">Nothing logged yet.</p>
        ) : (
          <div className="mt-3 flex flex-col">
            {logged.map(({ i, org }) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-default py-3"
              >
                <div className="min-w-0">
                  <span className="text-[13.5px] text-primary">{i.subject}</span>
                  {org ? <span className="ml-2 text-[12px] text-secondary">{org}</span> : null}
                </div>
                <span
                  className="text-[11.5px] text-tertiary"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {i.type.replace(/_/g, " ")} · logged {formatRelativeDays(i.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-secondary"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </h2>
  );
}
