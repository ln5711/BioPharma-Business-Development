"use client";

import { useEffect, useState } from "react";
import { Moon, Search, Sun } from "lucide-react";
import { PulsarMark } from "@/components/brand/pulsar-mark";

/**
 * Glassy header. Phone shows the pulsar mark + wordmark; all sizes get the ⌘K
 * search affordance, a live-ingest status pill, and a notification button.
 */
export function Topbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const s = localStorage.getItem("obd-theme");
      if (s === "light" || s === "dark") {
        setTheme(s);
        document.documentElement.dataset.theme = s === "light" ? "light" : "";
      }
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next === "light" ? "light" : "";
    try {
      localStorage.setItem("obd-theme", next);
    } catch {
      /* ignore */
    }
  };

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
          className="text-[17px] text-[#EDF2FF]"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}
        >
          newwin
        </span>
      </div>

      <button
        type="button"
        className="flex min-w-[170px] flex-1 items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-left transition-colors hover:border-[var(--accent-border)]"
        style={{ background: "rgba(150,185,255,.06)", borderColor: "rgba(150,185,255,.14)" }}
      >
        <Search size={13} strokeWidth={1.9} className="text-[var(--faint)]" />
        <span className="flex-1 truncate text-[13px] text-[var(--faint)]">
          Search accounts, assets, trials, people, pathways…
        </span>
        <kbd
          className="rounded-[5px] border px-1.5 py-0.5 text-[10.5px] text-[var(--dim)]"
          style={{ fontFamily: "var(--font-mono)", borderColor: "rgba(150,185,255,.16)" }}
        >
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-2 rounded-full border px-3 py-[7px] sm:flex"
          style={{ background: "rgba(143,211,255,.07)", borderColor: "rgba(143,211,255,.2)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#8FD3FF", boxShadow: "0 0 8px #8FD3FF" }}
          />
          <span
            className="whitespace-nowrap text-[11px] tracking-[0.1em] text-[#B7D9F5]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Live · ClinicalTrials.gov
          </span>
        </div>
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={toggle}
          className="grid h-10 w-10 place-items-center rounded-[11px] border text-[var(--muted)] transition-colors hover:text-white"
          style={{ background: "rgba(150,185,255,.06)", borderColor: "rgba(150,185,255,.14)" }}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-[11px] border text-[var(--muted)] transition-colors hover:text-white"
          style={{ background: "rgba(150,185,255,.06)", borderColor: "rgba(150,185,255,.14)" }}
        >
          <span className="h-[11px] w-[11px] rounded-[3px] border-[1.6px]" style={{ borderColor: "currentColor" }} />
          <span
            className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full"
            style={{ background: "#F0866A", boxShadow: "0 0 0 2px #100B22" }}
          />
        </button>
      </div>
    </header>
  );
}
