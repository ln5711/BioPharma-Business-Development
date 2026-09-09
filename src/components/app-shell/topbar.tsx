"use client";

import Link from "next/link";
import { signOutAction, signOutEverywhereAction, persistThemeAction } from "@/app/(app)/actions";
import { AskBar } from "@/components/ask/ask-bar";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { formatRelativeDays } from "@/lib/utils";

type IngestState = "not_configured" | "never" | "syncing" | "ok" | "failed";
export interface TopbarIngest {
  state: IngestState;
  atISO: string | null;
  detail: string | null;
}

/**
 * Glass header. Phone shows the pulsar mark + wordmark; every size gets the
 * compact Ask newwin bar, the real ingestion-status pill, a theme toggle and an
 * account menu.
 */
export function Topbar({
  userName,
  ingest,
}: {
  userName: string;
  ingest: TopbarIngest;
}) {
  const initials =
    userName
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "NW";

  return (
    <header
      className="flex flex-wrap items-center gap-3 border-b px-[22px] py-[13px]"
      style={{
        background: "var(--header-glass)",
        borderColor: "var(--hairline)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="flex items-center gap-2.5 md:hidden">
        <PulsarMark size={24} />
        <span
          className="text-[17px] text-primary"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}
        >
          newwin
        </span>
      </div>

      <div className="min-w-[180px] flex-1">
        <AskBar variant="header" />
      </div>

      <div className="flex items-center gap-2">
        <IngestPill ingest={ingest} />

        <ThemeToggle onPersist={(t) => persistThemeAction(t)} />

        <details className="group relative">
          <summary
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-[12px] font-bold [&::-webkit-details-marker]:hidden"
            style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
          >
            {initials}
          </summary>
          <div
            className="fixed inset-0 z-10 hidden group-open:block"
            onClick={(e) =>
              (e.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute("open")
            }
          />
          <div className="panel-glass absolute right-0 z-20 mt-2 w-[230px] overflow-hidden p-1.5">
            <div className="px-3 py-2 text-[12px] text-secondary">{userName}</div>
            <Link
              href="/settings"
              className="block rounded-[9px] px-3 py-2 text-[13px] text-primary hover:bg-[color:var(--selected-bg)]"
            >
              Priorities &amp; profile
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-[9px] px-3 py-2 text-left text-[13px] text-primary hover:bg-[color:var(--selected-bg)]"
              >
                Sign out
              </button>
            </form>
            <form action={signOutEverywhereAction}>
              <button
                type="submit"
                className="w-full rounded-[9px] px-3 py-2 text-left text-[13px] text-secondary hover:bg-[color:var(--selected-bg)]"
              >
                Sign out on all devices
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}

function IngestPill({ ingest }: { ingest: TopbarIngest }) {
  const map: Record<IngestState, { dot: string; label: string }> = {
    not_configured: { dot: "var(--faint)", label: "ClinicalTrials.gov · not configured" },
    never: { dot: "var(--warn)", label: "ClinicalTrials.gov · never synced" },
    syncing: { dot: "var(--accent)", label: "ClinicalTrials.gov · syncing…" },
    ok: { dot: "var(--success)", label: "" },
    failed: { dot: "var(--danger)", label: "ClinicalTrials.gov · last sync failed" },
  };
  const m = map[ingest.state];
  const label =
    ingest.state === "ok"
      ? `ClinicalTrials.gov · updated ${
          ingest.atISO ? formatRelativeDays(new Date(ingest.atISO)) : "recently"
        }`
      : m.label;

  return (
    <div
      className="hidden items-center gap-2 rounded-full border px-3 py-[7px] lg:flex"
      style={{ background: "var(--panel-2)", borderColor: "var(--hairline)" }}
      title={ingest.detail ?? undefined}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: m.dot,
          boxShadow: ingest.state === "syncing" ? "0 0 8px var(--accent)" : "none",
        }}
      />
      <span
        className="whitespace-nowrap text-[11.5px] tracking-[0.06em] text-secondary"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
    </div>
  );
}
