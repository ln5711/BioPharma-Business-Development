"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
] as const;

export function RangeFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("range", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: "rgba(150,185,255,.16)" }}
    >
      {RANGES.map((r) => {
        const on = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => set(r.id)}
            className="rounded-full px-3 py-1.5 text-[12px] transition-colors"
            style={{
              background: on ? "rgba(143,211,255,.16)" : "transparent",
              color: on ? "var(--accent-strong)" : "var(--muted)",
              fontWeight: on ? 600 : 400,
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
