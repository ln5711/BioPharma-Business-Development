"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MORE_NAV, PRIMARY_NAV } from "./nav";

/**
 * Collapsible left rail on a dark-navy gradient. Primary sections carry a round
 * dot marker; the "Workspace" group carries a rotated-square marker. Active =
 * a soft blue pill plus a bright left bar.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const s = localStorage.getItem("nw-rail");
      if (s === "0") setOpen(false);
    } catch {
      /* private mode */
    }
  }, []);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem("nw-rail", v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="flex shrink-0 flex-col overflow-hidden py-[18px] transition-[width] duration-300"
      style={{
        background: "var(--rail)",
        width: open ? "236px" : "72px",
        transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div className="flex items-center justify-between gap-2.5 px-4 pb-[22px]">
        {open ? (
          <Link
            href="/"
            className="whitespace-nowrap text-[21px] font-medium tracking-tight text-white"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.015em" }}
          >
            newwin
          </Link>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-[#a9bee4] transition-colors hover:text-white"
          style={{ background: "rgba(255,255,255,.07)" }}
        >
          {open ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
      </div>

      <RailGroup
        items={PRIMARY_NAV}
        open={open}
        isActive={isActive}
        marker="dot"
      />

      {open ? (
        <div
          className="mx-5 mb-2.5 mt-[22px] text-[10.5px] font-semibold uppercase"
          style={{ letterSpacing: "0.16em", color: "#5c7299" }}
        >
          Workspace
        </div>
      ) : (
        <div className="mx-4 my-3 border-t border-white/10" />
      )}
      <div className="flex-1 overflow-y-auto">
        <RailGroup items={MORE_NAV} open={open} isActive={isActive} marker="diamond" small />
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-[14px] pt-3.5">
        <span
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11.5px] font-semibold text-white"
          style={{ background: "linear-gradient(140deg,#3a6ee0,#1b4fd8)", letterSpacing: ".02em" }}
        >
          LN
        </span>
        {open ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] text-[#e4ecfa]">Luciann Nguyen</span>
            <span className="truncate text-[11px] text-[#7189b2]">Predicine · demo</span>
          </span>
        ) : null}
      </div>
    </nav>
  );
}

function RailGroup({
  items,
  open,
  isActive,
  marker,
  small,
}: {
  items: { label: string; href: string }[];
  open: boolean;
  isActive: (href: string) => boolean;
  marker: "dot" | "diamond";
  small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-[11px] rounded-[9px] px-3 transition-colors",
              small ? "min-h-[38px] py-2" : "min-h-[42px] py-2.5",
            )}
            style={{ background: active ? "rgba(58,110,224,.22)" : undefined }}
          >
            {active ? (
              <>
                <span
                  className="pointer-events-none absolute inset-0 rounded-[9px]"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(122,160,232,.3)" }}
                />
                <span
                  className="absolute left-[-10px] top-3 bottom-3 w-[3px] rounded-r"
                  style={{ background: "var(--nav-marker)" }}
                />
              </>
            ) : (
              <span className="pointer-events-none absolute inset-0 rounded-[9px] opacity-0 transition-opacity group-hover:opacity-100 group-hover:bg-white/[0.06]" />
            )}
            <span
              className={cn(
                "relative shrink-0",
                marker === "dot"
                  ? "h-[7px] w-[7px] rounded-full"
                  : "h-[5px] w-[5px] rotate-45",
              )}
              style={{ background: active ? "#6e9bf0" : "#3f567f" }}
            />
            {open ? (
              <span
                className={cn(
                  "relative whitespace-nowrap",
                  small ? "text-[13px]" : "text-[13.5px]",
                )}
                style={{
                  color: active ? "#fff" : "#a9bee4",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "-0.005em",
                }}
              >
                {item.label}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
