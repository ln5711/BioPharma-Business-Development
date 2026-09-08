import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { getDashboardCounts, getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, Stat } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Daily BD Command Center (spec §22 / §101 / §133) — an intelligence briefing. */
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

  return (
    <div>
      <header className="mb-8 rounded-[var(--radius-lg)] p-7 text-[var(--color-lavender-100)] brand-gradient">
        <div className="eyebrow" style={{ color: "var(--color-lavender-300)" }}>
          {tenant.name} · {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
        <h1 className="display-lg mt-2 text-white">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--color-lavender-300)]">
          Here&rsquo;s what changed across your oncology landscape. Every card is
          scored deterministically and carries its source.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <Stat value={counts.meaningfulSignals} label="Meaningful signals · 7d" />
          <Stat value={counts.highPriority} label="High-priority (≥70)" />
          <Stat value={counts.trialChanges7d} label="Trial changes · 7d" />
          <Stat value={counts.trialsTracked} label="Trials tracked" />
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="eyebrow">Your priorities</h2>
        <Link href="/signals" className="meta hover:text-[var(--fg)]">
          View all signals →
        </Link>
      </div>

      {signals.length === 0 ? (
        <EmptyState
          title="No scored signals yet"
          body="Run the ClinicalTrials.gov ingestion to populate the feed: `npm run ingest:ctgov`. The RAS/KRAS watchlist is seeded and ready — the job fetches matching oncology trials, snapshots them, and generates scored commercial signals."
          action={
            <Link
              href="/watchlists"
              className="rounded-md border px-3 py-1.5 text-[12.5px] font-medium"
            >
              Review watchlists
            </Link>
          }
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
