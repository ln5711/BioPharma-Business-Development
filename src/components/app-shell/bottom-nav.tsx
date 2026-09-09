"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV } from "./nav";

/** Phone tab bar — shown below md; diamond dots, glow on the active tab. */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="dark-scope flex shrink-0 border-t px-1.5 pb-2.5 pt-2 md:hidden"
      style={{ background: "rgba(10,8,22,.9)", borderColor: "var(--hairline)", backdropFilter: "blur(14px)" }}
    >
      {BOTTOM_NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[7px] rounded-xl transition-colors hover:bg-[rgba(150,185,255,.07)]"
          >
            <span
              className="h-[7px] w-[7px] rotate-45"
              style={{
                background: active ? "#8FD3FF" : "#4A5478",
                boxShadow: active ? "0 0 10px rgba(143,211,255,.9)" : "none",
              }}
            />
            <span
              className="text-[10.5px]"
              style={{ color: active ? "#F2F6FF" : "#7E8CB8", fontWeight: active ? 600 : 400 }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
