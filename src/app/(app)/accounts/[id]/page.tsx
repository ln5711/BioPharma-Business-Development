import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { commercialSignals, organizations, trials } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";
import { EmptyState, Pill, SectionHeading, StatRail } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import type { SignalRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Company intelligence profile (spec §20 / §139). */
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
    <div>
      <Link href="/accounts" className="meta hover:text-[var(--fg)]">
        ← Accounts
      </Link>

      <header className="mt-3 border-b pb-6">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="eyebrow mb-2 capitalize">
              {org.organizationType}
              {org.headquarters ? ` · ${org.headquarters}` : ""}
            </div>
            <h1 className="display-lg">{org.canonicalName}</h1>
          </div>
          <button
            className="shrink-0 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--fg)]"
            style={{ borderColor: "var(--hairline)" }}
          >
            Follow account
          </button>
        </div>

        <div className="mt-6">
          <StatRail
            items={[
              { value: topScore, label: "Account opportunity", tone: "accent" },
              { value: "Not established", label: "Relationship" },
              { value: signals.length, label: "Active signals" },
              { value: orgTrials.length, label: "Trials as sponsor" },
            ]}
          />
        </div>
      </header>

      <div className="mt-8">
        <SectionHeading>Why this account matters</SectionHeading>
        {signals.length === 0 ? (
          <EmptyState
            title="No commercial signals for this account"
            body="No meaningful oncology developments have been detected for this company in the monitored period. It stays on the watchlist for trial, publication and leadership changes."
          />
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--hairline)" }}>
            {signals.slice(0, 5).map((s, i) => (
              <OpportunityCard key={s.id} signal={s} index={i + 1} />
            ))}
          </div>
        )}
      </div>

      {orgTrials.length ? (
        <div className="mt-10">
          <SectionHeading>Trials</SectionHeading>
          <Table
            head={
              <>
                <Th>Trial</Th>
                <Th>Phase</Th>
                <Th>Testing language</Th>
              </>
            }
          >
            {orgTrials.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <Link
                    href={`/trials/${t.nctId}`}
                    className="font-mono text-[11.5px] text-[var(--accent)]"
                  >
                    {t.nctId}
                  </Link>
                  <div className="entity-name mt-0.5 line-clamp-1 max-w-[440px] text-[13.5px]">
                    {t.title}
                  </div>
                </Td>
                <Td className="text-[var(--muted)]">{t.phase.replace(/_/g, " ")}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {t.molecularEligibility ? <Pill tone="high">mol. elig.</Pill> : null}
                    {t.ctdnaMentions ? <Pill tone="info">ctDNA</Pill> : null}
                    {!t.molecularEligibility && !t.ctdnaMentions ? (
                      <span className="meta">—</span>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  );
}
