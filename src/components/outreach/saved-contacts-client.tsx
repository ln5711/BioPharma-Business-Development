"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { statusLabel, type ContactViewModel } from "@/lib/contacts/view-model";
import type { SavedContactFilters } from "@/lib/contacts/query-contacts";
import { ContactCard } from "./contact-card";
import { ExportMenu } from "./export-menu";
import { Pill } from "@/components/ui/primitives";
import { Table, Td, Th, Tr } from "@/components/ui/table";

/**
 * ONE client tree for the Saved/Favorites/Follow-ups tabs: card/table toggle,
 * row selection, and export all operate on the SAME server-fetched rows the
 * table renders — "the table is the live spreadsheet view of the same
 * database records."
 */
export function SavedContactsClient({
  initialRows,
  filters,
  emptyLabel,
}: {
  initialRows: ContactViewModel[];
  filters: SavedContactFilters;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Server actions call revalidatePath, which refreshes the Server Component
  // tree on the next router refresh — sync local state when that happens.
  useEffect(() => setRows(initialRows), [initialRows]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return <p className="text-[13px] text-[var(--muted)]">{emptyLabel}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-[8px] border" style={{ borderColor: "var(--card-border)" }}>
          <button
            type="button"
            onClick={() => setView("cards")}
            className="px-3 py-1.5 text-[12px]"
            style={view === "cards" ? { background: "var(--accent-btn)", color: "var(--accent-btn-ink)" } : { color: "var(--muted)" }}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className="px-3 py-1.5 text-[12px]"
            style={view === "table" ? { background: "var(--accent-btn)", color: "var(--accent-btn-ink)" } : { color: "var(--muted)" }}
          >
            Table
          </button>
        </div>
        <ExportMenu scope="filtered" selectedIds={[...selected]} filters={filters} />
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <ContactCard key={r.id} model={r} onChanged={() => router.refresh()} />
          ))}
        </div>
      ) : (
        <Table
          head={
            <>
              <Th></Th>
              <Th>Name</Th>
              <Th>Title / Company</Th>
              <Th>Function</Th>
              <Th>Email</Th>
              <Th>Relevance</Th>
              <Th>Status</Th>
              <Th>Owner</Th>
              <Th align="right">Last contacted</Th>
              <Th align="right">Next follow-up</Th>
            </>
          }
        >
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
              </Td>
              <Td>
                <span className="text-[13px] text-[var(--fg)]">{r.name}</span>
                {r.favorite ? <span className="ml-1.5 text-[#F0C94A]">★</span> : null}
              </Td>
              <Td className="text-[var(--muted)]">{[r.title, r.company].filter(Boolean).join(" · ") || "—"}</Td>
              <Td className="text-[var(--muted)]">{r.function.replace(/_/g, " ")}</Td>
              <Td className="text-[var(--muted)]">
                {r.email ?? "—"}
                {r.email ? <Pill tone={r.emailProvenance === "publicly_sourced" ? "positive" : r.emailProvenance === "inferred_pattern" ? "medium" : "neutral"} className="ml-1.5">{r.emailProvenance.replace(/_/g, " ")}</Pill> : null}
              </Td>
              <Td align="right" className="tnum">{r.relevanceScore ?? "—"}</Td>
              <Td>
                <Pill tone="info">{statusLabel(r.outreachStatus)}</Pill>
              </Td>
              <Td className="text-[var(--muted)]">{r.ownerName ?? "—"}</Td>
              <Td align="right" className="text-[var(--muted)]">{r.lastContactedAt?.slice(0, 10) ?? "—"}</Td>
              <Td align="right" className="text-[var(--muted)]">{r.nextFollowUpAt?.slice(0, 10) ?? "—"}</Td>
            </Tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-[11px] text-[var(--faint)]">
        Need a different filter? <Link href="/outreach?tab=saved" className="underline">Reset</Link> or adjust filters above.
      </p>
    </div>
  );
}
