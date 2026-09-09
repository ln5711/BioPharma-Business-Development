"use client";

import { useEffect, useState } from "react";
import { Bell, Moon, Search, Sun } from "lucide-react";

/**
 * Slim translucent header. Full-width ⌘K search affordance, a Copilot button
 * with a pulsing signal dot, theme toggle, and a notification button.
 * Search + Copilot are wired in a later slice.
 */
export function Topbar() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const s = localStorage.getItem("obd-theme");
      if (s === "dark" || s === "light") {
        setTheme(s);
        document.documentElement.dataset.theme = s;
      }
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("obd-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <header
      className="flex flex-wrap items-center gap-3.5 border-b px-[22px] py-3"
      style={{
        background: "color-mix(in srgb, var(--panel) 72%, transparent)",
        backdropFilter: "blur(10px)",
        borderColor: "var(--hairline)",
      }}
    >
      <button
        type="button"
        className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-[10px] border bg-[var(--panel)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-sky-300)]"
        style={{ borderColor: "#dce6f6" }}
      >
        <Search size={14} strokeWidth={1.9} className="text-[var(--faint)]" />
        <span className="flex-1 truncate text-[13px] text-[var(--faint)]">
          Search companies, assets, trials, people, pathways…
        </span>
        <kbd
          className="rounded-[5px] border px-1.5 py-0.5 text-[11px] text-[var(--faint)]"
          style={{ fontFamily: "var(--font-mono)", background: "#f5f8fe", borderColor: "#e2e9f5" }}
        >
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-2 rounded-[10px] border bg-[var(--panel)] px-3 py-2.5 text-[12.5px] font-medium text-[var(--color-navy-800)] transition-transform hover:-translate-y-px hover:bg-[var(--color-sky-50)]"
          style={{ borderColor: "#c9d9fa" }}
        >
          <span
            className="relative h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)" }}
          >
            <span
              className="absolute -inset-[3px] rounded-full"
              style={{ background: "var(--accent)", animation: "nw-pulse 2.4s ease-in-out infinite" }}
            />
          </span>
          Copilot
        </button>
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={toggle}
          className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border bg-[var(--panel)] text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
          style={{ borderColor: "#dce6f6" }}
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] border bg-[var(--panel)] text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
          style={{ borderColor: "#dce6f6" }}
        >
          <Bell size={15} />
          <span
            className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full"
            style={{ background: "var(--color-critical)", boxShadow: "0 0 0 2px var(--panel)" }}
          />
        </button>
      </div>
    </header>
  );
}
