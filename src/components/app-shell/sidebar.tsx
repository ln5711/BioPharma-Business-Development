"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav";

/** Deep-plum left rail with a subtle elevated violet active state (spec §131). */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-dvh w-[236px] shrink-0 flex-col justify-between px-3 py-5"
      style={{ background: "var(--nav-bg)", color: "var(--nav-fg)" }}
    >
      <div>
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-violet-600)] text-[13px] font-bold text-white">
            O
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Oncology BD
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors",
                  active
                    ? "font-medium"
                    : "hover:bg-white/5",
                )}
                style={
                  active
                    ? {
                        background: "var(--nav-active-bg)",
                        color: "var(--nav-fg-active)",
                      }
                    : undefined
                }
              >
                <item.icon size={16} strokeWidth={1.75} className="shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-2.5 py-[7px] text-[13.5px] hover:bg-white/5"
        >
          <Settings size={16} strokeWidth={1.75} className="opacity-90" />
          Settings
        </Link>
        <div className="flex items-center gap-3 rounded-md px-2.5 py-[7px] text-[13.5px]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
            <UserRound size={14} strokeWidth={1.75} />
          </span>
          <span className="truncate">Luciann Nguyen</span>
        </div>
      </div>
    </aside>
  );
}
