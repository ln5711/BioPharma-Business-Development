"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NAV } from "./nav";

/**
 * Deep-plum left rail. Active state is a quiet left marker + brightened label,
 * not a filled pill (spec §131 / §154 — restraint over chrome).
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-dvh w-[224px] shrink-0 flex-col justify-between px-3 py-6"
      style={{ background: "var(--nav-bg)", color: "var(--nav-fg)" }}
    >
      <div>
        <Link href="/" className="mb-8 flex items-baseline gap-2 px-3">
          <span
            className="text-[18px] font-medium lowercase tracking-tight text-white"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            newwin
          </span>
        </Link>

        <nav className="flex flex-col gap-px">
          {ALL_NAV.map((item, i) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[var(--radius-sm)] py-[7px] pl-3 pr-2.5 text-[13px] transition-colors",
                  active ? "text-white" : "hover:bg-white/[0.04]",
                  i === 1 || i === 4 || i === 6 ? "mt-2" : "",
                )}
                style={active ? { background: "rgba(255,255,255,0.05)" } : undefined}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ background: "var(--nav-marker)" }}
                  />
                ) : null}
                <item.icon
                  size={15}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0 transition-opacity",
                    active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-px border-t border-white/[0.07] pt-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-[var(--radius-sm)] py-[7px] pl-3 pr-2.5 text-[13px] hover:bg-white/[0.04]"
        >
          <Settings size={15} strokeWidth={1.75} className="opacity-70" />
          Settings
        </Link>
        <div className="mt-1 flex items-center gap-2.5 px-3 py-1.5 text-[13px]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08]">
            <UserRound size={13} strokeWidth={1.75} />
          </span>
          <span className="truncate text-white/85">Luciann Nguyen</span>
        </div>
      </div>
    </aside>
  );
}
