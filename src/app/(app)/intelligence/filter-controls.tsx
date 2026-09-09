"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const SINCE = [
  ["", "Any time"],
  ["1", "Last 24h"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
] as const;

const TYPES = [
  ["", "All types"],
  ["NEW_TRIAL", "New trials"],
  ["TRIAL_STATUS_CHANGE", "Status changes"],
  ["TRIAL_PHASE_CHANGE", "Phase changes"],
  ["NEW_PUBLICATION", "Publications"],
  ["NEW_DATA_READOUT", "Data readouts"],
] as const;

/** URL-persisted Intelligence filters. */
export function IntelligenceFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("signal");
    start(() => router.push(`/intelligence?${next.toString()}`));
  };
  const val = (k: string) => params.get(k) ?? "";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" data-pending={pending || undefined}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          set({ q: String(fd.get("q") ?? "") });
        }}
        className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border px-3 py-2"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      >
        <input
          name="q"
          defaultValue={val("q")}
          placeholder="Search headline, company, NCT id…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
        />
        <button type="submit" className="text-[12px] font-semibold text-[var(--accent)]">
          Search
        </button>
      </form>

      <input
        defaultValue={val("company")}
        onBlur={(e) => set({ company: e.target.value })}
        placeholder="Company"
        className="w-[150px] rounded-[10px] border px-2.5 py-2 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      />

      {[
        { k: "since", opts: SINCE },
        { k: "type", opts: TYPES },
      ].map(({ k, opts }) => (
        <select
          key={k}
          value={val(k)}
          onChange={(e) => set({ [k]: e.target.value })}
          className="rounded-[10px] border px-2.5 py-2 text-[12.5px] text-[var(--fg)]"
          style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
        >
          {opts.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      ))}

      <select
        value={val("min")}
        onChange={(e) => set({ min: e.target.value })}
        className="rounded-[10px] border px-2.5 py-2 text-[12.5px] text-[var(--fg)]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      >
        <option value="">Any score</option>
        <option value="70">Score ≥ 70</option>
        <option value="50">Score ≥ 50</option>
      </select>

      {[...params.keys()].some((k) => ["q", "company", "since", "type", "min"].includes(k)) ? (
        <button
          onClick={() => start(() => router.push("/intelligence"))}
          className="text-[12px] text-[var(--muted)] underline"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
