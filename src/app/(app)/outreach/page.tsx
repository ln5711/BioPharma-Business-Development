import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { getUserPrefs, RANGE_MS } from "@/lib/user-prefs";
import { getRecommendations } from "@/lib/recommendations/engine";
import { PageHeader } from "@/components/ui/primitives";
import { formatRelativeDays } from "@/lib/utils";
import { LogOutreachForm } from "./log-outreach-form";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const prefs = await getUserPrefs(user.id);

  const [recs, logged] = await Promise.all([
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
  ]);

  const outreachRecs = recs.filter((r) => r.type === "signal" || r.type === "follow_up" || r.type === "account");

  return (
    <div>
      <PageHeader
        eyebrow="Log & follow-ups"
        title="Outreach"
        description="Where you record outreach you've already sent and track the follow-ups it created. newwin does not send messages — no email, drip or CRM integration is connected."
      />

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
