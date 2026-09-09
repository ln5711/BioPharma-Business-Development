import { getActiveTenant } from "@/lib/tenant";
import { getSignalById, getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { IntelligenceFilters } from "./filter-controls";

export const dynamic = "force-dynamic";

/**
 * Intelligence — one unified feed. Supports company / free-text / type / score /
 * timeframe filters (all URL-persisted) and a `?signal=<id>` deep link that pins
 * the exact signal with its evidence above the feed.
 */
export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { tenant } = await getActiveTenant();
  const sp = await searchParams;

  const min = Number(sp.min) || undefined;
  const sinceDays = Number(sp.since) || undefined;

  const pinned = sp.signal ? await getSignalById(tenant.id, sp.signal) : null;

  const { rows, total } = await getTopSignals(tenant.id, {
    limit: 80,
    minScore: min,
    company: sp.company || undefined,
    q: sp.q || undefined,
    type: sp.type || undefined,
    sinceDays,
  });

  const feed = pinned ? rows.filter((s) => s.id !== pinned.id) : rows;

  return (
    <div>
      <PageHeader
        eyebrow="Unified feed"
        title="Intelligence"
        description="Every commercial event across your monitored oncology universe — deduplicated, classified and scored against your priorities. Fact, inference and recommendation stay separate on every entry."
      />

      <IntelligenceFilters />

      {pinned ? (
        <div className="mb-6">
          <div
            className="mb-2 text-[10.5px] uppercase tracking-[0.16em] text-[var(--accent)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Highlighted signal
          </div>
          <div
            className="rounded-[14px] border-2 p-1"
            style={{ borderColor: "var(--accent-border)", background: "var(--accent-tint)" }}
          >
            <OpportunityCard signal={pinned} index={1} />
          </div>
          {feed.length > 0 ? (
            <div className="mt-6 text-[12.5px] text-[var(--muted)]">Rest of the feed</div>
          ) : null}
        </div>
      ) : (
        <div className="mb-3 text-[12.5px] text-[var(--muted)]">
          {total === 0 ? "Nothing matches these filters" : `${total} signal${total === 1 ? "" : "s"}`}
        </div>
      )}

      {feed.length === 0 && !pinned ? (
        <EmptyState
          title={total === 0 && !sp.q && !sp.company ? "Nothing in the feed yet" : "No matching signals"}
          body={
            total === 0 && !sp.q && !sp.company
              ? "No commercial events have been ingested for your workspace. Create a monitoring query on the Monitoring page to pull trials and changes from ClinicalTrials.gov."
              : "Loosen a filter or widen the timeframe."
          }
        />
      ) : (
        <div>
          {feed.map((s, i) => (
            <OpportunityCard key={s.id} signal={s} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
