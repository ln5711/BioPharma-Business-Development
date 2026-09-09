import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Intelligence — one unified feed. Signals, publications, company updates, trial
 * changes, hires, partnerships, licensing and regulatory developments all land
 * here rather than in separate tabs.
 */
export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ min?: string }>;
}) {
  const { tenant } = await getActiveTenant();
  const sp = await searchParams;
  const min = Number(sp.min) || 1;
  const signals = await getTopSignals(tenant.id, { limit: 80, minScore: min });

  return (
    <div>
      <PageHeader
        eyebrow="Unified feed"
        title="Intelligence"
        description="Every commercial event across your monitored oncology universe — deduplicated, classified and scored against your priorities. Fact, inference and recommendation stay separate on every entry."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { label: "All", href: "/intelligence" },
          { label: "High priority (≥70)", href: "/intelligence?min=70" },
        ].map((f) => {
          const on = (f.href.includes("min=70") ? min >= 70 : min < 70);
          return (
            <Link
              key={f.label}
              href={f.href}
              className="rounded-full border px-3.5 py-2 text-[12.5px] transition-colors"
              style={{
                borderColor: on ? "rgba(143,211,255,.5)" : "rgba(150,185,255,.16)",
                background: on ? "rgba(143,211,255,.14)" : "transparent",
                color: on ? "var(--accent-strong)" : "var(--muted)",
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {signals.length === 0 ? (
        <EmptyState
          title="Nothing in the feed yet"
          body="No meaningful oncology developments have been ingested. Run `npm run ingest:ctgov` to pull the RAS/KRAS watchlist from ClinicalTrials.gov."
        />
      ) : (
        <div>
          {signals.map((s, i) => (
            <OpportunityCard key={s.id} signal={s} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
