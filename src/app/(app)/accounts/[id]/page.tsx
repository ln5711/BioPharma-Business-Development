import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { commercialSignals, organizations, trials } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { Card, EmptyState, Pill } from "@/components/ui/primitives";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import type { SignalRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Bloomberg-style account intelligence profile (spec §20 / §139). */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getActiveTenant();
  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.tenantId, tenant.id)))
    .limit(1);
  if (!org) notFound();

  const orgTrials = await db
    .select()
    .from(trials)
    .where(eq(trials.sponsorOrganizationId, org.id))
    .orderBy(desc(trials.lastCtgovUpdate))
    .limit(50);

  const rawSignals = await db
    .select()
    .from(commercialSignals)
    .where(eq(commercialSignals.organizationId, org.id))
    .orderBy(desc(commercialSignals.opportunityScore))
    .limit(20);

  const signals: SignalRow[] = rawSignals.map((s) => ({
    ...s,
    organizationName: org.canonicalName,
    trialNctId: orgTrials.find((t) => t.id === s.trialId)?.nctId ?? null,
  }));

  const topScore = signals[0]?.opportunityScore ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/accounts" className="meta hover:text-[var(--fg)]">
          ← Accounts
        </Link>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <h1 className="display-lg text-[28px]">{org.canonicalName}</h1>
            <p className="meta mt-1 capitalize">
              {org.organizationType}
              {org.headquarters ? ` · ${org.headquarters}` : ""}
            </p>
          </div>
          <button className="rounded-md border px-3 py-1.5 text-[12.5px] font-medium">
            Follow account
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="eyebrow">Account opportunity</div>
          <div className="metric-number mt-1 text-[22px]">{topScore}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Relationship</div>
          <div className="mt-1 text-[15px] font-medium">Not established</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Active signals</div>
          <div className="metric-number mt-1 text-[22px]">{signals.length}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Trials as sponsor</div>
          <div className="metric-number mt-1 text-[22px]">{orgTrials.length}</div>
        </Card>
      </div>

      <section>
        <h2 className="eyebrow mb-3">Why this account matters</h2>
        {signals.length === 0 ? (
          <EmptyState
            title="No commercial signals for this account"
            body="No meaningful oncology developments have been detected for this company in the monitored period. It stays on the watchlist for trial, publication and leadership changes."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {signals.slice(0, 5).map((s) => (
              <OpportunityCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </section>

      {orgTrials.length ? (
        <section>
          <h2 className="eyebrow mb-3">Trials</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <tbody>
                {orgTrials.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-[var(--panel-2)]">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/trials/${t.nctId}`}
                        className="font-mono text-[12px] text-[var(--accent)]"
                      >
                        {t.nctId}
                      </Link>
                      <div className="line-clamp-1 max-w-[420px] text-[13px]">
                        {t.title}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">
                      {t.phase.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2.5">
                      {t.molecularEligibility ? <Pill tone="high">mol. elig.</Pill> : null}
                      {t.ctdnaMentions ? <Pill tone="info">ctDNA</Pill> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
