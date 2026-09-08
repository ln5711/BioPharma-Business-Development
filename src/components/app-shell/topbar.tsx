"use client";

import { useEffect, useState } from "react";
import { Bell, Moon, Search, Sparkles, Sun } from "lucide-react";

/** Quiet global command bar (spec §132) — understated field, text-weight actions. */
export function Topbar() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem("obd-theme");
      } catch {
        return null;
      }
    })();
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("obd-theme", next);
    } catch {
      /* private mode — ignore */
    }
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 border-b px-8"
      style={{ background: "var(--bg)", borderColor: "var(--hairline)" }}
    >
      <div className="flex flex-1 items-center gap-2.5 text-[13px]" style={{ color: "var(--faint)" }}>
        <Search size={15} strokeWidth={1.75} />
        <span>Search companies, assets, trials, people, pathways…</span>
        <kbd
          className="ml-auto rounded border px-1.5 py-0.5 text-[10.5px] tracking-wide"
          style={{ borderColor: "var(--hairline)" }}
        >
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
          aria-label="Toggle theme"
          onClick={toggle}
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
          aria-label="Notifications"
        >
          <Bell size={15} />
        </button>
        <button
          type="button"
          className="ml-1 flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-[12.5px] font-medium text-[var(--accent)]"
          style={{ borderColor: "color-mix(in oklab, var(--accent) 35%, transparent)" }}
        >
          <Sparkles size={13} /> Copilot
        </button>
      </div>
    </header>
  );
}
