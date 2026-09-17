"use client";

import { useState, useTransition } from "react";
import type { SavedContactFilters } from "@/lib/contacts/query-contacts";

interface Preview {
  headers: readonly string[];
  sampleRows: (string | number)[][];
  totalRows: number;
  validations?: { personId: string; name: string; issues: string[] }[];
  note?: string;
}

/** CSV/XLSX/Salesforce export, generated server-side from the LATEST persisted
 * state at click time — never a stale client snapshot. Downloading never marks
 * anything as CRM-synced. */
export function ExportMenu({
  scope,
  selectedIds,
  filters,
}: {
  scope: "filtered" | "all";
  selectedIds: string[];
  filters: SavedContactFilters;
}) {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [includeInferred, setIncludeInferred] = useState(false);
  const [open, setOpen] = useState(false);

  const effectiveScope = selectedIds.length ? "selected" : scope;

  async function download(format: "csv" | "xlsx", preset: "tracker" | "salesforce") {
    const res = await fetch("/api/contacts/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format, preset, scope: effectiveScope, personIds: selectedIds, filters, includeInferredEmail: includeInferred }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const cd = res.headers.get("content-disposition") ?? "";
    const m = /filename="([^"]+)"/.exec(cd);
    a.href = url;
    a.download = m?.[1] ?? `newwin-export.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadPreview(preset: "tracker" | "salesforce") {
    const res = await fetch("/api/contacts/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "csv", preset, scope: effectiveScope, personIds: selectedIds, filters, includeInferredEmail: includeInferred, preview: true }),
    });
    if (res.ok) setPreview(await res.json());
    setOpen(true);
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[var(--faint)]">
          {selectedIds.length ? `${selectedIds.length} selected` : effectiveScope === "filtered" ? "Current filtered view" : "All saved contacts"}
        </span>
        <ExportButton label="CSV" onClick={() => start(() => download("csv", "tracker"))} disabled={pending} />
        <ExportButton label="XLSX" onClick={() => start(() => download("xlsx", "tracker"))} disabled={pending} />
        <ExportButton label="Preview tracker" onClick={() => start(() => loadPreview("tracker"))} disabled={pending} subtle />
        <span className="mx-1 h-4 w-px" style={{ background: "var(--card-border)" }} />
        <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
          <input type="checkbox" checked={includeInferred} onChange={(e) => setIncludeInferred(e.target.checked)} />
          Include inferred emails
        </label>
        <ExportButton label="Salesforce CSV" onClick={() => start(() => download("csv", "salesforce"))} disabled={pending} />
        <ExportButton label="Salesforce XLSX" onClick={() => start(() => download("xlsx", "salesforce"))} disabled={pending} />
        <ExportButton label="Preview Salesforce mapping" onClick={() => start(() => loadPreview("salesforce"))} disabled={pending} subtle />
      </div>

      {open && preview ? (
        <div className="card fade-in absolute right-0 top-[calc(100%+8px)] z-30 max-h-[70vh] w-[min(720px,90vw)] overflow-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[var(--fg)]">
              {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"} — showing first {preview.sampleRows.length}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-[var(--muted)] underline">
              Close
            </button>
          </div>
          {preview.note ? <p className="mb-2 text-[11px] text-[var(--faint)]">{preview.note}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1 text-left text-[var(--faint)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--card-border)" }}>
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1 text-[var(--muted)]">{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.validations?.length ? (
            <div className="mt-3 rounded-[8px] border p-2.5 text-[11px]" style={{ borderColor: "rgba(240,166,106,.35)", background: "rgba(240,166,106,.08)", color: "#F0A66A" }}>
              <div className="mb-1 font-medium">{preview.validations.length} row(s) need review before Salesforce import:</div>
              <ul className="flex flex-col gap-0.5">
                {preview.validations.slice(0, 10).map((v) => (
                  <li key={v.personId}>{v.name}: {v.issues.join("; ")}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExportButton({ label, onClick, disabled, subtle }: { label: string; onClick: () => void; disabled?: boolean; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[8px] px-3 py-1.5 text-[11.5px] font-medium transition-colors disabled:opacity-60"
      style={subtle ? { color: "var(--muted)" } : { border: "1px solid var(--card-border)", color: "var(--fg)" }}
    >
      {label}
    </button>
  );
}
