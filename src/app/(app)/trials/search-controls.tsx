"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PHASES = [
  ["", "Any phase"],
  ["1", "Phase 1"],
  ["1/2", "Phase 1/2"],
  ["2", "Phase 2"],
  ["2/3", "Phase 2/3"],
  ["3", "Phase 3"],
  ["4", "Phase 4"],
] as const;
const STATUSES = [
  ["", "Any status"],
  ["recruiting", "Recruiting"],
  ["not_yet_recruiting", "Not yet recruiting"],
  ["active", "Active, not recruiting"],
  ["completed", "Completed"],
  ["terminated", "Terminated / withdrawn"],
] as const;
const UPDATED = [
  ["", "Any time"],
  ["7", "Updated ≤ 7 days"],
  ["30", "Updated ≤ 30 days"],
  ["90", "Updated ≤ 90 days"],
] as const;

/** URL-persisted trial search. Every change writes back to the query string. */
export function TrialSearchControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // any filter change resets pagination
    start(() => router.push(`/trials?${next.toString()}`));
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
        className="flex min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border px-3 py-2"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      >
        <input
          name="q"
          defaultValue={val("q")}
          placeholder="Search NCT id, title, sponsor, drug…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
        />
        <button type="submit" className="text-[12px] font-semibold text-[var(--accent)]">
          Search
        </button>
      </form>

      <input
        defaultValue={val("biomarker")}
        onBlur={(e) => set({ biomarker: e.target.value })}
        placeholder="Biomarker"
        className="w-[130px] rounded-[10px] border px-2.5 py-2 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      />
      <input
        defaultValue={val("indication")}
        onBlur={(e) => set({ indication: e.target.value })}
        placeholder="Indication"
        className="w-[140px] rounded-[10px] border px-2.5 py-2 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
      />

      {[
        { k: "phase", opts: PHASES },
        { k: "status", opts: STATUSES },
        { k: "updated", opts: UPDATED },
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

      {[...params.keys()].some((k) => ["q", "biomarker", "indication", "phase", "status", "updated", "company"].includes(k)) ? (
        <button
          onClick={() => start(() => router.push("/trials"))}
          className="text-[12px] text-[var(--muted)] underline"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
