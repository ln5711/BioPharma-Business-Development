"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { NAV_GROUPS } from "./nav";

/**
 * Glassy left rail. Navigation is grouped; the active item gets a cyan wash +
 * inset ring and a glowing diamond dot. Collapses to a 70px rail (persisted).
 */
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem("nw-rail") === "0") setOpen(false);
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem("nw-rail", v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="hidden shrink-0 flex-col border-r py-[22px] md:flex"
      style={{
        width: open ? "232px" : "70px",
        background: "var(--nav-glass)",
        borderColor: "var(--hairline)",
        backdropFilter: "blur(12px)",
        transition: "width .34s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div className="flex items-center gap-[11px] px-4 pb-6">
        <PulsarMark size={28} />
        {open ? (
          <span
            className="whitespace-nowrap text-[18.5px] text-[#EDF2FF]"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}
          >
            newwin
          </span>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#9AA3C0] transition-colors hover:text-white"
          style={{ background: "rgba(150,185,255,.08)" }}
        >
          {open ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-2.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label || gi} className="flex flex-col gap-0.5 pb-3.5">
            {group.label && open ? (
              <div
                className="px-3 pb-2 pt-3 text-[9.5px] font-semibold uppercase"
                style={{ letterSpacing: ".22em", color: "#5D6890", fontFamily: "var(--font-mono)" }}
              >
                {group.label}
              </div>
            ) : group.label ? (
              <div className="mx-2 my-2 border-t border-white/10" />
            ) : null}

            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="group relative flex min-h-[40px] items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors"
                >
                  {active ? (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[10px]"
                      style={{
                        background:
                          "linear-gradient(96deg, rgba(143,211,255,.16), rgba(143,211,255,.03))",
                        boxShadow: "inset 0 0 0 1px rgba(143,211,255,.22)",
                      }}
                    />
                  ) : (
                    <span className="pointer-events-none absolute inset-0 rounded-[10px] opacity-0 transition-opacity group-hover:opacity-100 group-hover:bg-[rgba(150,185,255,.07)]" />
                  )}
                  <span
                    className={cn("relative h-[6px] w-[6px] shrink-0 rotate-45")}
                    style={{
                      background: active ? "#8FD3FF" : "#4A5478",
                      boxShadow: active ? "0 0 10px rgba(143,211,255,.9)" : "none",
                    }}
                  />
                  {open ? (
                    <span
                      className="relative whitespace-nowrap text-[13px]"
                      style={{ color: active ? "#F2F6FF" : "#9AA3C0", fontWeight: active ? 600 : 400 }}
                    >
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="flex items-center gap-[11px] border-t px-4 pt-3.5"
        style={{ borderColor: "var(--hairline)" }}
      >
        <span
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
          style={{ background: "linear-gradient(140deg,#7FC4F8,#5A7FE8)", color: "#06101F" }}
        >
          LN
        </span>
        {open ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] text-[#E4E9F8]">Luciann Nguyen</span>
            <span className="truncate text-[11px] text-[#6B7398]">Predicine · demo</span>
          </span>
        ) : null}
      </div>
    </nav>
  );
}
