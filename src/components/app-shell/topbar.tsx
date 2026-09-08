"use client";

import { useEffect, useState } from "react";
import { Bell, Command, Moon, Search, Sparkles, Sun } from "lucide-react";

/** Global command/search bar (spec §132). Search + copilot are wired in a later slice. */
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
      className="flex h-14 shrink-0 items-center gap-3 border-b px-5"
      style={{ background: "var(--panel)", borderColor: "var(--hairline)" }}
    >
      <div
        className="flex h-9 flex-1 items-center gap-2.5 rounded-md border px-3 text-[13px]"
        style={{ background: "var(--panel-2)", borderColor: "var(--hairline)", color: "var(--muted)" }}
      >
        <Search size={15} strokeWidth={1.75} />
        <span>Search companies, assets, trials, people, pathways…</span>
        <kbd className="ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]">
          <Command size={11} /> K
        </kbd>
      </div>

      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-md border text-[var(--muted)] hover:text-[var(--fg)]"
        style={{ borderColor: "var(--hairline)" }}
        aria-label="Toggle theme"
        onClick={toggle}
      >
        {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
      </button>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-md border text-[var(--muted)] hover:text-[var(--fg)]"
        style={{ borderColor: "var(--hairline)" }}
        aria-label="Notifications"
      >
        <Bell size={15} />
      </button>
      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-white"
        style={{ background: "var(--color-violet-600)" }}
      >
        <Sparkles size={14} /> Copilot
      </button>
    </header>
  );
}
