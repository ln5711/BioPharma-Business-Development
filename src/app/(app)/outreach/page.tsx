import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, organizations } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { getUserPrefs, RANGE_MS } from "@/lib/user-prefs";
import { getRecommendations } from "@/lib/recommendations/engine";
import { PageHeader } from "@/components/ui/primitives";
import { formatRelativeDays } from "@/lib/utils";
import { logOutreach } from "./actions";

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
        eyebrow="Composer & log"
        title="Outreach"
        description="Recommended outreach, drafts, what you've logged, and follow-ups — connected back to the signal, account and people that produced each one."
      />

      <section className="mb-9">
        <SectionLabel>Recommended</SectionLabel>
        {outreachRecs.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--muted)]">No outreach recommended right now.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {outreachRecs.map((r) => (
              <div
                key={r.key}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-[var(--fg)]" style={{ fontFamily: "var(--font-serif)" }}>
                    {r.title}
                  </div>
                  <div className="mt-1 max-w-[70ch] text-[12.5px] text-[var(--muted)]">{r.reason}</div>
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
        <SectionLabel>Log outreach</SectionLabel>
        <form action={logOutreach} className="panel-glass mt-3 grid gap-3 p-5 sm:grid-cols-2">
          <input name="contact" placeholder="Contact name" className={input} />
          <input name="account" placeholder="Target account (company)" className={input} />
          <input name="subject" placeholder="Subject" className={`${input} sm:col-span-2`} />
          <textarea name="body" rows={3} placeholder="Message or note…" className={`${input} sm:col-span-2 resize-none`} />
          <div className="flex items-center gap-2 sm:col-span-2">
            <select name="channel" className={input + " max-w-[140px]"} defaultValue="email">
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <button
              type="submit"
              className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
              style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
            >
              Log as sent
            </button>
          </div>
        </form>
      </section>

      <section>
        <SectionLabel>Logged</SectionLabel>
        {logged.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--muted)]">Nothing logged yet.</p>
        ) : (
          <div className="mt-3 flex flex-col">
            {logged.map(({ i, org }) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
                style={{ borderColor: "rgba(150,185,255,.09)" }}
              >
                <div className="min-w-0">
                  <span className="text-[13.5px] text-[var(--fg)]">{i.subject}</span>
                  {org ? <span className="ml-2 text-[12px] text-[var(--muted)]">{org}</span> : null}
                </div>
                <span className="text-[11.5px] text-[var(--faint)]" style={{ fontFamily: "var(--font-mono)" }}>
                  {i.type.replace(/_/g, " ")} · {formatRelativeDays(i.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const input =
  "w-full rounded-[10px] border border-[rgba(150,185,255,.16)] bg-[rgba(10,8,22,.5)] px-3 py-2.5 text-[13.5px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent-border)]";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10.5px] uppercase"
      style={{ letterSpacing: ".22em", color: "#B7BFD8", fontFamily: "var(--font-mono)", fontWeight: 600 }}
    >
      {children}
    </h2>
  );
}
