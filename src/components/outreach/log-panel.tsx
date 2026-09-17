"use client";

import { useEffect, useState, useTransition } from "react";
import { getContactHistory, type HistoryItem } from "@/app/(app)/outreach/actions";

const input =
  "w-full rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]";
const inputStyle = { borderColor: "var(--card-border)" };

/** Quick logging form + expandable history for ONE contact. Never touches
 * another person's data — `personId` is fixed per instance. */
export function LogPanel({
  personId,
  onLogged,
  logAction,
}: {
  personId: string;
  onLogged?: () => void;
  logAction: (formData: FormData) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [channel, setChannel] = useState("email");
  const [followUp, setFollowUp] = useState(false);

  useEffect(() => {
    getContactHistory(personId).then(setHistory);
  }, [personId]);

  return (
    <div className="rounded-[10px] border p-3" style={{ borderColor: "var(--card-border)", background: "rgba(150,185,255,.03)" }}>
      <form
        action={(fd) => {
          fd.set("personId", personId);
          start(async () => {
            const res = await logAction(fd);
            setMsg(res.ok ? res.message ?? "Logged." : res.error ?? "Failed.");
            if (res.ok) {
              setHistory(await getContactHistory(personId));
              onLogged?.();
            }
          });
        }}
        className="grid gap-2 sm:grid-cols-2"
      >
        <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={input} style={inputStyle}>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="conference">Conference</option>
          <option value="note">Internal note</option>
        </select>
        <select name="direction" defaultValue="outbound" className={input} style={inputStyle}>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        <input name="subject" placeholder="Subject" className={`${input} sm:col-span-2`} style={inputStyle} />
        <textarea name="body" rows={2} placeholder="Message or notes…" className={`${input} sm:col-span-2 resize-none`} style={inputStyle} />
        <input name="outcome" placeholder="Outcome (optional)" className={input} style={inputStyle} />
        <input name="nextStep" placeholder="Next step (optional)" className={input} style={inputStyle} />
        <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)] sm:col-span-2">
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
          Schedule a follow-up
        </label>
        {followUp ? <input type="date" name="followUpDate" className={`${input} sm:col-span-2`} style={inputStyle} /> : null}
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
        >
          {channel === "note" ? "Save note" : "Log outreach"}
        </button>
      </form>
      {msg ? <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">{msg}</p> : null}

      {history?.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: "var(--card-border)" }}>
          {history.map((h) => (
            <li key={h.id} className="text-[11.5px] text-[var(--muted)]">
              <span className="text-[var(--faint)]">{h.occurredAt.slice(0, 10)}</span>{" "}
              <span className="uppercase" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{h.type.replace(/_/g, " ")}</span>
              {h.subject ? <> — {h.subject}</> : null}
              {h.outcome ? <span className="ml-1 text-[var(--faint)]">({h.outcome})</span> : null}
            </li>
          ))}
        </ul>
      ) : history?.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--faint)]">No activity logged yet.</p>
      ) : null}
    </div>
  );
}
