"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Search, Sun } from "lucide-react";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { signOutAction } from "@/app/(app)/actions";
import { AskBar } from "@/components/ask/ask-bar";

/**
 * Glass header. Phone shows the pulsar mark + wordmark; every size gets the
 * compact Ask newwin bar, a live-ingest pill, theme toggle and an account menu.
 */
export function Topbar({
  userName,
  authenticated,
}: {
  userName: string;
  authenticated: boolean;
}) {
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
          className="text-[17px] text-[#EDF2FF]"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}
        >
          newwin
        </span>
      </div>

      <div className="min-w-[180px] flex-1">
        <AskBar variant="header" />
      </div>

      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-2 rounded-full border px-3 py-[7px] lg:flex"
          style={{ background: "rgba(143,211,255,.07)", borderColor: "rgba(143,211,255,.2)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#8FD3FF", boxShadow: "0 0 8px #8FD3FF" }}
          />
          <span
            className="whitespace-nowrap text-[11.5px] tracking-[0.08em] text-[#C6DEF6]"
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

        <details className="group relative">
          <summary
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-[12px] font-bold [&::-webkit-details-marker]:hidden"
            style={{ background: "linear-gradient(140deg,#7FC4F8,#5A7FE8)", color: "#06101F" }}
          >
            {initials}
          </summary>
          <div
            className="fixed inset-0 z-10 hidden group-open:block"
            onClick={(e) =>
              (e.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute("open")
            }
          />
          <div
            className="panel-glass absolute right-0 z-20 mt-2 w-[220px] overflow-hidden p-1.5"
          >
            <div className="px-3 py-2 text-[12px] text-[var(--muted)]">{userName}</div>
            <Link
              href="/settings"
              className="block rounded-[9px] px-3 py-2 text-[13px] text-[var(--fg)] hover:bg-[rgba(150,185,255,.08)]"
            >
              Priorities &amp; profile
            </Link>
            {authenticated ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-[9px] px-3 py-2 text-left text-[13px] text-[var(--fg)] hover:bg-[rgba(150,185,255,.08)]"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/welcome"
                className="block rounded-[9px] px-3 py-2 text-[13px] text-[var(--accent)] hover:bg-[rgba(150,185,255,.08)]"
              >
                Sign in / Create account
              </Link>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
