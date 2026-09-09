import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { getDashboardCounts, getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, StatRail } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Daily BD command center (spec §22 / §101 / §133) — a territory briefing. */
export default async function DashboardPage() {
  const { tenant, user } = await getActiveTenant();
  const [counts, signals] = await Promise.all([
    getDashboardCounts(tenant.id),
    getTopSignals(tenant.id, { limit: 8, minScore: 1 }),
  ]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const n = counts.meaningfulSignals;
  const summary =
    n === 0
      ? "A quiet stretch — no meaningful developments detected across your monitored oncology universe in the last seven days."
      : counts.highPriority > 0
        ? `${n} meaningful development${n === 1 ? "" : "s"} crossed your monitored oncology universe in the last seven days. ${counts.highPriority} cleared the priority threshold.`
        : `${n} meaningful development${n === 1 ? "" : "s"} in the last seven days. None cleared the priority threshold yet.`;

  const cap = (v: number) => Math.min(100, v);

  return (
    <div>
      <header>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
          {tenant.name}
          <span className="mx-2">·</span>
          Territory briefing
          <span className="mx-2">·</span>
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h1 className="display-xl mt-3.5">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-3.5 max-w-[62ch] text-[15.5px] leading-[1.6] text-[var(--muted)]">
          {summary}
        </p>

        <div className="mt-7 border-t pt-5">
          <StatRail
            items={[
              {
                value: counts.meaningfulSignals,
                label: "Signals · 7 days",
                width: cap(counts.meaningfulSignals * 4),
              },
              {
                value: counts.highPriority,
                label: "High priority (≥ 70)",
                tone: "accent",
                width: cap(counts.highPriority * 8),
              },
              {
                value: counts.trialChanges7d,
                label: "Trial changes · 7 days",
                width: cap(counts.trialChanges7d * 6),
              },
              {
                value: counts.trialsTracked,
                label: "Trials tracked",
                width: cap(counts.trialsTracked),
              },
            ]}
          />
        </div>
      </header>

      <div className="mt-10 flex items-end justify-between gap-4 border-b pb-3">
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Today&rsquo;s priorities
        </h2>
        <Link href="/signals" className="text-[12.5px] font-medium text-[var(--accent)]">
          All signals →
        </Link>
      </div>

      {signals.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No scored signals yet"
            body="Run the ClinicalTrials.gov ingestion to populate the feed — `npm run ingest:ctgov`. The RAS/KRAS watchlist is seeded and ready: the job fetches matching oncology trials, snapshots them, and generates scored commercial signals."
            action={
              <Link
                href="/watchlists"
                className="text-[12.5px] font-medium text-[var(--accent)]"
              >
                Review watchlists →
              </Link>
            }
          />
        </div>
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
