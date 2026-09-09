"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { PRIMARY_NAV } from "./nav";

/**
 * Six-tab glass rail. Active item: cyan wash + inset ring + a glowing diamond.
 * A "You" footer links to priorities / settings. Collapses to 70px (persisted).
 */
export function Sidebar({ userName }: { userName: string }) {
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
      className="dark-scope hidden shrink-0 flex-col border-r py-[22px] md:flex"
      style={{
        width: open ? "230px" : "70px",
        background: "var(--nav-glass)",
        borderColor: "var(--hairline)",
        backdropFilter: "blur(12px)",
        transition: "width .34s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div className="flex items-center gap-[11px] px-4 pb-7">
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
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#AEB6D0] transition-colors hover:text-white"
          style={{ background: "rgba(150,185,255,.08)" }}
        >
          {open ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2.5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="group relative flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors"
            >
              {active ? (
                <span
                  className="pointer-events-none absolute inset-0 rounded-[10px]"
                  style={{
                    background:
                      "linear-gradient(96deg, rgba(143,211,255,.18), rgba(143,211,255,.04))",
                    boxShadow: "inset 0 0 0 1px rgba(143,211,255,.26)",
                  }}
                />
              ) : (
                <span className="pointer-events-none absolute inset-0 rounded-[10px] opacity-0 transition-opacity group-hover:opacity-100 group-hover:bg-[rgba(150,185,255,.07)]" />
              )}
              <item.icon
                size={16}
                strokeWidth={1.9}
                className="relative shrink-0"
                style={{ color: active ? "#8FD3FF" : "#9AA3C0" }}
              />
              {open ? (
                <span
                  className="relative whitespace-nowrap text-[13.5px]"
                  style={{ color: active ? "#F2F6FF" : "#AEB6D0", fontWeight: active ? 600 : 400 }}
                >
                  {item.label}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t px-2.5 pt-3" style={{ borderColor: "var(--hairline)" }}>
        <Link
          href="/settings"
          className="group relative flex min-h-[40px] items-center gap-3 rounded-[10px] px-3 py-2 transition-colors hover:bg-[rgba(150,185,255,.07)]"
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} className="shrink-0 text-[#9AA3C0]" />
          {open ? <span className="text-[13px] text-[#AEB6D0]">Priorities & profile</span> : null}
        </Link>
        <div className="flex items-center gap-[11px] px-3 pt-2">
          <span
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
            style={{ background: "linear-gradient(140deg,#7FC4F8,#5A7FE8)", color: "#06101F" }}
          >
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "NW"}
          </span>
          {open ? (
            <span className="truncate text-[12.5px] text-[#E4E9F8]">{userName}</span>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
