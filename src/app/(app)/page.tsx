import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { getDashboardCounts, getTopSignals } from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, SectionHeading, StatRail } from "@/components/ui/primitives";

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
      ? "A quiet stretch — no meaningful developments detected across your monitored universe in the last seven days."
      : counts.highPriority > 0
        ? `${n} meaningful signal${n === 1 ? "" : "s"} in the last seven days. ${counts.highPriority} scored 70 or above and warrant a closer look.`
        : `${n} meaningful signal${n === 1 ? "" : "s"} in the last seven days. None cleared the priority threshold yet.`;

  return (
    <div>
      <header className="aura-panel mb-9">
        <div className="kicker flex items-center gap-1.5">
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: "var(--accent)" }}
          />
          {tenant.name} &nbsp;·&nbsp; Territory briefing &nbsp;·&nbsp;{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h1 className="display-xl mt-3">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-[var(--muted)]">
          {summary}
        </p>

        <div className="mt-8 border-t pt-6">
          <StatRail
            items={[
              { value: counts.meaningfulSignals, label: "Signals · 7d" },
              {
                value: counts.highPriority,
                label: "High priority",
                tone: "accent",
              },
              { value: counts.trialChanges7d, label: "Trial changes · 7d" },
              { value: counts.trialsTracked, label: "Trials tracked" },
            ]}
          />
        </div>
      </header>

      <SectionHeading
        aside={
          <Link href="/signals" className="hover:text-[var(--fg)]">
            All signals →
          </Link>
        }
      >
        Today&rsquo;s priorities
      </SectionHeading>

      {signals.length === 0 ? (
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
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--hairline)" }}>
          {signals.map((s, i) => (
            <OpportunityCard key={s.id} signal={s} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
