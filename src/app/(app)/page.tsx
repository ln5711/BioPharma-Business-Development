import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import {
  getDashboardCounts,
  getTopSignals,
  listAccounts,
} from "@/lib/queries";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { EmptyState, GlassPanel, SectionHeading, Stat } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Command centre (spec §22 / §101 / §133) — the sequenced morning briefing. */
export default async function DashboardPage() {
  const { tenant, user } = await getActiveTenant();
  const [counts, signals, accounts] = await Promise.all([
    getDashboardCounts(tenant.id),
    getTopSignals(tenant.id, { limit: 8, minScore: 1 }),
    listAccounts(tenant.id, 6),
  ]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const n = counts.meaningfulSignals;
  const body =
    n === 0
      ? "A quiet stretch — no meaningful developments crossed your monitored universe in the last seven days."
      : `${n} meaningful development${n === 1 ? "" : "s"} crossed your monitored oncology universe in the last seven days. ${counts.highPriority} cleared the priority threshold — sequenced below, highest decay risk first.`;

  const cap = (v: number, d = 1) => Math.min(100, Math.round(v * d));

  const sequence = [
    counts.highPriority > 0 && {
      title: `Review ${counts.highPriority} priority signal${counts.highPriority === 1 ? "" : "s"}`,
      body: "Events above the score threshold, ordered by decay risk. Two typically involve prospective ctDNA selection in RAS-mutant tumours.",
      href: "/signals",
      state: "Do this now",
    },
    counts.trialChanges7d > 0 && {
      title: `Scan ${counts.trialChanges7d} trial change${counts.trialChanges7d === 1 ? "" : "s"}`,
      body: "Registry amendments since the last refresh, already mapped to accounts and assets.",
      href: "/trials",
      state: "Queued",
    },
    {
      title: "Clear the outreach queue",
      body: "Approved drafts past their optimal send window. Reply likelihood drops ~40% after day three.",
      href: "/outreach",
      state: "Queued",
    },
  ].filter(Boolean) as { title: string; body: string; href: string; state: string }[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="kicker">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · {tenant.name} workspace
          </div>
          <h1 className="display-xl mt-3.5">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-3.5 max-w-[66ch] text-[15px] leading-[1.65] text-[var(--muted)]">
            {body}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-[22px] gap-y-4">
          <Stat value={counts.meaningfulSignals} label="New signals" width={cap(counts.meaningfulSignals, 4)} />
          <Stat value={counts.highPriority} label="Above threshold" tone="accent" width={cap(counts.highPriority, 8)} />
          <Stat value={counts.trialChanges7d} label="Trial changes" width={cap(counts.trialChanges7d, 6)} />
          <Stat value={counts.trialsTracked} label="Trials tracked" width={cap(counts.trialsTracked)} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-[22px] xl:grid-cols-[minmax(0,1.85fr)_minmax(280px,1fr)]">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <GlassPanel className="p-6 pb-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  className="text-[10.5px] font-semibold uppercase"
                  style={{ letterSpacing: ".24em", color: "#8FD3FF" }}
                >
                  Your sequence for today
                </div>
                <p className="mt-2 max-w-[54ch] text-[13.5px] leading-[1.55] text-[var(--muted)]">
                  Ordered by decay risk, then value. Work top to bottom.
                </p>
              </div>
              <span
                className="text-[11px] text-[var(--faint)]"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: ".08em" }}
              >
                {sequence.length} steps
              </span>
            </div>

            <div className="mt-5">
              {sequence.map((s, i) => (
                <div key={s.title} className="grid grid-cols-[38px_1fr] gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border text-[12px]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        background: i === 0 ? "rgba(143,211,255,.18)" : "rgba(150,185,255,.06)",
                        color: i === 0 ? "#DDF1FF" : "#8B94B4",
                        borderColor: i === 0 ? "rgba(143,211,255,.5)" : "rgba(150,185,255,.14)",
                        boxShadow: i === 0 ? "0 0 18px rgba(143,211,255,.35)" : "none",
                      }}
                    >
                      {i + 1}
                    </span>
                    {i < sequence.length - 1 ? (
                      <span
                        className="my-1.5 w-px flex-1"
                        style={{
                          background: "linear-gradient(180deg, rgba(143,211,255,.3), rgba(143,211,255,.06))",
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-[22px]">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span
                        className="text-[18px]"
                        style={{ fontFamily: "var(--font-serif)", color: "#F2F6FF" }}
                      >
                        {s.title}
                      </span>
                      <span
                        className="text-[10.5px] uppercase"
                        style={{
                          letterSpacing: ".16em",
                          color: i === 0 ? "#8FD3FF" : "#5D6890",
                        }}
                      >
                        {s.state}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.58] text-[var(--muted)]">
                      {s.body}
                    </p>
                    <Link
                      href={s.href}
                      className="mt-2.5 inline-flex rounded-[9px] border px-3.5 py-2 text-[12.5px] transition-colors"
                      style={{
                        borderColor: "rgba(143,211,255,.3)",
                        background: "rgba(143,211,255,.1)",
                        color: "#CDE9FF",
                      }}
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <section>
            <SectionHeading aside={<Link href="/signals">All signals →</Link>}>
              Priority signals
            </SectionHeading>
            {signals.length === 0 ? (
              <EmptyState
                title="No scored signals yet"
                body="Run the ClinicalTrials.gov ingestion to populate the feed — `npm run ingest:ctgov`. The RAS/KRAS watchlist is seeded and ready."
                action={
                  <Link href="/watchlists" className="text-[12.5px] text-[var(--accent)]">
                    Review watchlists →
                  </Link>
                }
              />
            ) : (
              <div>
                {signals.map((s, i) => (
                  <OpportunityCard key={s.id} signal={s} index={i + 1} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="relative overflow-hidden rounded-[16px] border p-5" style={{ borderColor: "rgba(150,185,255,.14)", background: "linear-gradient(160deg, rgba(150,180,255,.08), rgba(120,140,220,.02))" }}>
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(143,211,255,.16), transparent 70%)" }}
            />
            <div className="relative">
              <div
                className="text-[10.5px] font-semibold uppercase"
                style={{ letterSpacing: ".22em", color: "#8FD3FF" }}
              >
                Accounts to watch
              </div>
              <div className="mt-3.5 flex flex-col gap-3">
                {accounts.length === 0 ? (
                  <p className="meta">No accounts resolved yet.</p>
                ) : (
                  accounts.map(({ org, signalCount, topScore }) => (
                    <Link
                      key={org.id}
                      href={`/accounts/${org.id}`}
                      className="-m-[7px] flex items-center gap-3 rounded-[10px] p-[7px] transition-colors hover:bg-[rgba(150,185,255,.07)]"
                    >
                      <span
                        className="h-[7px] w-[7px] min-w-[7px] rounded-full"
                        style={{
                          background: topScore >= 75 ? "#8FD3FF" : "#7FA6F0",
                          boxShadow: topScore >= 75 ? "0 0 10px #8FD3FF" : "none",
                        }}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13.5px] text-[#E4E9F8]">
                          {org.canonicalName}
                        </span>
                        <span className="truncate text-[11.5px] text-[var(--faint)]">
                          {signalCount} signal{signalCount === 1 ? "" : "s"} · {org.organizationType}
                        </span>
                      </span>
                      <span
                        className="text-[17px]"
                        style={{ fontFamily: "var(--font-serif)", color: "#B7D9F5" }}
                      >
                        {topScore}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border p-5" style={{ borderColor: "rgba(150,185,255,.12)", background: "rgba(150,180,255,.045)" }}>
            <div className="flex items-center justify-between gap-3">
              <div
                className="text-[10.5px] font-semibold uppercase"
                style={{ letterSpacing: ".22em", color: "#8FD3FF" }}
              >
                Feed status
              </div>
              <span className="text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                live
              </span>
            </div>
            <div className="mt-3.5 flex flex-col gap-2.5 text-[12.5px]">
              <Row k="Source" v="ClinicalTrials.gov v2" />
              <Row k="Trials tracked" v={String(counts.trialsTracked)} />
              <Row k="Changes · 7 days" v={String(counts.trialChanges7d)} />
              <Row k="Watchlist" v="RAS / KRAS oncology" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="text-right text-[#E4E9F8]">{v}</span>
    </div>
  );
}
