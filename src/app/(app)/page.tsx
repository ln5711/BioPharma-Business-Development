import Link from "next/link";
import { getActiveTenant } from "@/lib/tenant";
import { getDashboardCounts } from "@/lib/queries";
import { getUserPrefs, RANGE_MS, type HomeRange } from "@/lib/user-prefs";
import { getRecommendations } from "@/lib/recommendations/engine";
import { AskBar } from "@/components/ask/ask-bar";
import { RangeFilter } from "./range-filter";
import { addQuickPriority, recFeedback } from "./home-actions";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { tenant, user, authenticated } = await getActiveTenant();
  const prefs = await getUserPrefs(user.id);
  const sp = await searchParams;
  const range = (["24h", "7d", "30d"].includes(sp.range ?? "")
    ? sp.range
    : prefs.homeRange) as HomeRange;
  const sinceMs = RANGE_MS[range];

  const [counts, recs] = await Promise.all([
    getDashboardCounts(tenant.id, sinceMs),
    getRecommendations({ tenantId: tenant.id, userId: user.id, prefs, sinceMs, limit: 6 }),
  ]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const heading = authenticated && user?.lastLoginAt ? "Welcome back" : greet;

  const rangeLabel = range === "24h" ? "24 hours" : range === "7d" ? "7 days" : "30 days";

  const metrics = [
    { value: counts.trialsTracked, label: "Trials tracked", href: "/trials" },
    { value: counts.trialChanges, label: `Changes detected · ${rangeLabel}`, href: "/trials" },
    { value: counts.highPriority, label: `High-priority signals · ${rangeLabel}`, href: "/intelligence?min=70", accent: true },
    { value: counts.accountsActive, label: `Accounts with activity · ${rangeLabel}`, href: "/accounts" },
    { value: counts.meaningfulSignals, label: `Signals · ${rangeLabel}`, href: "/intelligence" },
    { value: counts.openTasks, label: "Follow-ups & tasks due", href: "/outreach" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="text-[11px] uppercase"
            style={{ letterSpacing: ".22em", color: "var(--faint)", fontFamily: "var(--font-mono)" }}
          >
            {tenant.name} · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="display-xl mt-3">
            {heading}, {firstName}.
          </h1>
          <p className="mt-2.5 text-[15px] text-[var(--muted)]">Here&rsquo;s what matters today.</p>
        </div>
        <RangeFilter value={range} />
      </div>

      <div className="mt-7">
        <AskBar variant="home" />
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="card card-lift block p-4"
          >
            <div
              className="tnum leading-none"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "2rem",
                fontWeight: 300,
                color: m.accent ? "var(--accent)" : "var(--fg)",
              }}
            >
              {m.value}
            </div>
            <div className="mt-2 text-[11.5px] leading-[1.35] text-[var(--muted)]">{m.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-9 flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: "rgba(150,185,255,.12)" }}>
        <h2
          className="text-[11px] uppercase"
          style={{ letterSpacing: ".24em", color: "#B7BFD8", fontFamily: "var(--font-mono)", fontWeight: 600 }}
        >
          Today&rsquo;s priorities
        </h2>
        <span className="text-[12px] text-[var(--faint)]">{recs.length} recommended</span>
      </div>

      {recs.length === 0 ? (
        <p className="mt-6 max-w-[60ch] text-[14px] leading-[1.6] text-[var(--muted)]">
          Nothing crossed the threshold in the last {rangeLabel.toLowerCase()}. Widen the range,
          run the ClinicalTrials.gov ingestion, or add a priority below.
        </p>
      ) : (
        <div className="mt-4 flex flex-col">
          {recs.map((r, i) => (
            <article
              key={r.key}
              className="fade-in grid grid-cols-[34px_1fr] gap-4 border-b py-5"
              style={{ borderColor: "rgba(150,185,255,.09)" }}
            >
              <div
                className="tnum pt-0.5 text-right text-[13px]"
                style={{ fontFamily: "var(--font-serif)", color: "#97A5BC" }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  {r.entityLabel ? (
                    <span
                      className="text-[10.5px] font-semibold uppercase"
                      style={{ letterSpacing: ".16em", color: "#B7BFD8" }}
                    >
                      {r.entityLabel}
                    </span>
                  ) : null}
                  <span
                    className="rounded-[4px] px-2 py-[2px] text-[10.5px]"
                    style={{ color: "#8FD3FF", background: "rgba(143,211,255,.1)" }}
                  >
                    {r.type.replace("_", " ")}
                  </span>
                </div>
                <h3
                  className="mt-1.5 text-[17px] leading-[1.32]"
                  style={{ fontFamily: "var(--font-serif)", color: "#EDF1FC" }}
                >
                  {r.title}
                </h3>
                <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.58] text-[var(--body)]">
                  <span
                    className="mr-2 text-[10px] uppercase"
                    style={{ letterSpacing: ".16em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}
                  >
                    Why this matters
                  </span>
                  {r.reason}
                </p>
                <p className="mt-1.5 max-w-[64ch] text-[13px] leading-[1.55] text-[var(--muted)]">
                  <span
                    className="mr-2 text-[10px] uppercase"
                    style={{ letterSpacing: ".16em", color: "var(--faint)", fontFamily: "var(--font-mono)" }}
                  >
                    Next step
                  </span>
                  {r.nextStep}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] text-[var(--faint)] hover:text-[var(--fg)]">
                    Why am I seeing this?
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {r.why.map((w, j) => (
                      <li key={j} className="flex gap-2 text-[12px] text-[var(--muted)]">
                        <span className="diamond mt-[6px]" style={{ width: 3, height: 3 }} />
                        {w}
                      </li>
                    ))}
                  </ul>
                </details>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={r.action.href}
                    className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
                    style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
                  >
                    {r.action.label}
                  </Link>
                  <form action={recFeedback}>
                    <input type="hidden" name="key" value={r.key} />
                    <input type="hidden" name="status" value="deferred" />
                    <button className="rounded-[9px] border px-3 py-2 text-[12px] text-[var(--muted)] hover:text-[var(--fg)]" style={{ borderColor: "rgba(150,185,255,.14)" }}>
                      Defer
                    </button>
                  </form>
                  <form action={recFeedback}>
                    <input type="hidden" name="key" value={r.key} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button className="rounded-[9px] px-3 py-2 text-[12px] text-[var(--faint)] hover:text-[var(--fg)]">
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <form action={addQuickPriority} className="mt-6 flex gap-2">
        <input
          name="text"
          required
          maxLength={200}
          placeholder="+ Add a priority — e.g. Prepare Novartis presentation today"
          className="flex-1 rounded-[11px] border border-[rgba(150,185,255,.16)] bg-[rgba(10,8,22,.5)] px-3.5 py-3 text-[13.5px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent-border)]"
        />
        <button
          type="submit"
          className="rounded-[11px] border px-4 py-3 text-[12.5px] text-[#CDE9FF]"
          style={{ borderColor: "rgba(143,211,255,.3)", background: "rgba(143,211,255,.1)" }}
        >
          Add
        </button>
      </form>
    </div>
  );
}
