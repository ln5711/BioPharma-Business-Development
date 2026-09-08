import { getActiveTenant } from "@/lib/tenant";
import { getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Intelligence Feed (spec §23 / §143) — curated, scored, actionable. */
export default async function SignalsPage() {
  const { tenant } = await getActiveTenant();
  const signals = await getTopSignals(tenant.id, { limit: 60 });

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence feed"
        title="Signals"
        description="Deduplicated commercial signals across the monitored oncology universe, ranked by deterministic opportunity score. Fact, inference and recommendation are kept separate on every card."
      />
      {signals.length === 0 ? (
        <EmptyState
          title="No signals match the current data"
          body="No meaningful oncology developments have been ingested yet. Run `npm run ingest:ctgov` to pull the RAS/KRAS watchlist from ClinicalTrials.gov."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {signals.map((s) => (
            <OpportunityCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  );
}
