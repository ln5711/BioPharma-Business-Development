"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  generateOutreachDraft,
  saveOutreachDraft,
  type DraftResult,
} from "./draft-actions";

interface EvidenceRef {
  kind: string;
  id: string;
  label: string;
  url: string;
}

export interface ComposerProps {
  draftId?: string;
  personId?: string;
  organizationId?: string;
  nctId?: string;
  signalId?: string;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
  evidenceRefs?: EvidenceRef[];
  aiConfigured: boolean;
}

/**
 * Outreach composer for a selected authorized contact. "Generate" produces a
 * Claude draft grounded in the trial/signal/account + your capabilities; you
 * edit recipient/subject/body freely, then "Save draft". Saving never sends and
 * never logs the message as sent — those are separate actions.
 */
export function Composer(props: ComposerProps) {
  const [subject, setSubject] = useState(props.subject ?? "");
  const [body, setBody] = useState(props.body ?? "");
  const [recipientName, setRecipientName] = useState(props.recipientName ?? "");
  const [recipientEmail, setRecipientEmail] = useState(props.recipientEmail ?? "");
  const [draftId, setDraftId] = useState(props.draftId);

  const [genState, genAction, genPending] = useActionState<DraftResult | null, FormData>(
    generateOutreachDraft,
    null,
  );
  const [saveState, saveAction, savePending] = useActionState<DraftResult | null, FormData>(
    saveOutreachDraft,
    null,
  );

  useEffect(() => {
    if (genState?.ok) {
      setSubject(genState.subject);
      setBody(genState.body);
      setDraftId(genState.draftId);
    }
  }, [genState]);
  useEffect(() => {
    if (saveState?.ok) setDraftId(saveState.draftId);
  }, [saveState]);

  const hidden = (
    <>
      {draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
      {props.personId ? <input type="hidden" name="personId" value={props.personId} /> : null}
      {props.organizationId ? (
        <input type="hidden" name="organizationId" value={props.organizationId} />
      ) : null}
      {props.nctId ? <input type="hidden" name="nctId" value={props.nctId} /> : null}
      {props.signalId ? <input type="hidden" name="signalId" value={props.signalId} /> : null}
    </>
  );

  return (
    <div className="panel-glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] text-[var(--fg)]" style={{ fontFamily: "var(--font-serif)" }}>
          Compose outreach{recipientName ? ` — ${recipientName}` : ""}
        </h2>
        <form action={genAction}>
          {hidden}
          <button
            type="submit"
            disabled={genPending}
            className="inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--accent-border)", background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            <Sparkles size={13} /> {genPending ? "Generating…" : draftId ? "Regenerate" : "Generate with Claude"}
          </button>
        </form>
      </div>

      {!props.aiConfigured ? (
        <p className="mt-2 text-[11.5px] text-[var(--warn)]">
          No language model configured — Generate produces an editable template. Set
          ANTHROPIC_API_KEY for a grounded draft.
        </p>
      ) : null}
      {genState && !genState.ok ? (
        <p className="mt-2 text-[12px] text-[var(--danger)]">{genState.error}</p>
      ) : null}

      {props.evidenceRefs?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.evidenceRefs.map((e) => (
            <Link
              key={`${e.kind}:${e.id}`}
              href={e.url}
              className="rounded-full border px-2.5 py-1 text-[11px]"
              style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
            >
              {e.kind}: {e.label.slice(0, 44)}
            </Link>
          ))}
        </div>
      ) : null}

      <form action={saveAction} className="mt-4 flex flex-col gap-3">
        {hidden}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-[var(--faint)]">Recipient</span>
            <input
              name="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-[var(--faint)]">Recipient email</span>
            <input
              name="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="input"
              placeholder="optional"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--faint)]">Subject</span>
          <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--faint)]">Message</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="input resize-y font-[inherit]"
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <input type="checkbox" name="createFollowup" value="1" />
          Create a follow-up task in
          <input name="followupDays" type="number" min={1} max={30} defaultValue={3} className="input w-[60px] !py-1" />
          days
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={savePending}
            className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
            style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
          >
            {savePending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`);
            }}
            className="rounded-[10px] border px-3 py-2.5 text-[12.5px]"
            style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
          >
            Copy
          </button>
          {saveState?.ok ? (
            <span className="text-[12px] text-[var(--success)]">
              Draft saved. It is not sent — sending is not connected.
            </span>
          ) : saveState && !saveState.ok ? (
            <span className="text-[12px] text-[var(--danger)]">{saveState.error}</span>
          ) : null}
        </div>
        <p className="text-[11px] text-[var(--faint)]">
          Save draft, &ldquo;Log outreach already sent&rdquo;, and provider-backed Send are
          separate. This screen only saves an editable draft.
        </p>
      </form>
    </div>
  );
}
