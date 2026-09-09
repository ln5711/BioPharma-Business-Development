"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MORE_NAV, PRIMARY_NAV } from "./nav";

/**
 * Horizontal top nav — Linear / Vercel style. Wordmark, inline primary
 * sections, a "More" menu for the rest, then search + theme + copilot + account.
 */
export function TopNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-30 flex h-[52px] items-center gap-5 border-b px-5"
      style={{ background: "var(--bg)", borderColor: "var(--hairline)" }}
    >
      <Link
        href="/"
        className="shrink-0 text-[17px] font-medium lowercase tracking-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        newwin
      </Link>

      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "text-[var(--fg)]"
                  : "text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {item.label}
              {active ? (
                <span
                  className="absolute inset-x-2.5 -bottom-[15px] h-[2px] rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              ) : null}
            </Link>
          );
        })}

        <Menu
          label={
            <>
              More <ChevronDown size={13} />
            </>
          }
          active={MORE_NAV.some((i) => isActive(i.href))}
        >
          {MORE_NAV.map((item) => (
            <MenuLink key={item.href} href={item.href}>
              <item.icon size={14} strokeWidth={1.75} className="opacity-70" />
              {item.label}
            </MenuLink>
          ))}
        </Menu>
      </nav>

      <div className="hidden items-center gap-2 md:flex">
        <span
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[12.5px]"
          style={{ borderColor: "var(--hairline)", color: "var(--faint)" }}
        >
          <Search size={13} strokeWidth={1.75} />
          Search
          <kbd className="rounded border px-1 text-[10px]" style={{ borderColor: "var(--hairline)" }}>
            ⌘K
          </kbd>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <IconBtn label="Notifications">
          <Bell size={15} />
        </IconBtn>
        <button
          type="button"
          className="ml-1 flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-[12.5px] font-medium text-[var(--accent)]"
          style={{ borderColor: "color-mix(in oklab, var(--accent) 35%, transparent)" }}
        >
          <Sparkles size={13} /> Copilot
        </button>
        <Menu
          align="right"
          label={
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--panel-2)]">
              <UserRound size={14} strokeWidth={1.75} />
            </span>
          }
        >
          <div className="px-3 py-2 text-[12.5px] text-[var(--muted)]">
            Luciann Nguyen
          </div>
          <MenuLink href="/settings">
            <Settings size={14} strokeWidth={1.75} className="opacity-70" />
            Settings
          </MenuLink>
        </Menu>
      </div>
    </header>
  );
}

function IconBtn({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
    >
      {children}
    </button>
  );
}

function ThemeToggle() {
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
    <IconBtn label="Toggle theme" onClick={toggle}>
      {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
    </IconBtn>
  );
}

/** Zero-JS dropdown via <details>; closes on outside click through a backdrop. */
function Menu({
  label,
  children,
  active,
  align = "left",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  align?: "left" | "right";
}) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors [&::-webkit-details-marker]:hidden",
          active ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]",
        )}
      >
        {label}
      </summary>
      <div
        className="fixed inset-0 z-10 hidden group-open:block"
        onClick={(e) => {
          (e.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute(
            "open",
          );
        }}
      />
      <div
        className={cn(
          "card fade-in absolute z-20 mt-2 min-w-[180px] overflow-hidden p-1",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] text-[var(--fg)] hover:bg-[var(--panel-2)]"
    >
      {children}
    </Link>
  );
}
