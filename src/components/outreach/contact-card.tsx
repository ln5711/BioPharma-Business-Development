"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Mail, Star, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Pill } from "@/components/ui/primitives";
import {
  CONTACT_LABEL_TEXT,
  EMAIL_DELIVERABILITY_TEXT,
  EMAIL_PROVENANCE_TEXT,
  OUTREACH_STATUS_OPTIONS,
  initials,
  statusLabel,
  type ContactViewModel,
} from "@/lib/contacts/view-model";
import {
  addToTracker,
  logOutreach,
  resolveConflict,
  toggleFavorite,
  updateContactEmail,
  updateOutreachStatus,
} from "@/app/(app)/outreach/actions";
import { LogPanel } from "./log-panel";
import { DraftPanel } from "./draft-panel";

const LABEL_TONE: Record<string, "high" | "info" | "neutral"> = {
  direct_program_evidence: "high",
  relevant_function_unconfirmed: "info",
  potential_introducer: "neutral",
};
const PROVENANCE_TONE: Record<string, "positive" | "medium" | "neutral" | "warning"> = {
  publicly_sourced: "positive",
  inferred_pattern: "medium",
  user_supplied: "neutral",
  not_found: "warning",
};

export function ContactCard({ model, onChanged }: { model: ContactViewModel; onChanged?: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<"none" | "history" | "draft" | "email" | "sources">("none");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState(model.email ?? "");

  const saved = model.saved;
  const canLog = Boolean(model.personId);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? res.message ?? null : res.error ?? "Something went wrong.");
      onChanged?.();
    });
  }

  return (
    <div className="card fade-in flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Headshot model={model} />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] text-[var(--fg)]" style={{ fontFamily: "var(--font-serif)" }}>
              {model.name}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-[var(--muted)]">
              {[model.title, model.company].filter(Boolean).join(" · ") || "—"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {model.contactLabel ? <Pill tone={LABEL_TONE[model.contactLabel]}>{CONTACT_LABEL_TEXT[model.contactLabel]}</Pill> : null}
              <Pill tone="neutral">{model.function.replace(/_/g, " ")}</Pill>
              {model.seniority !== "unknown" ? <Pill tone="neutral">{model.seniority.replace(/_/g, " ")}</Pill> : null}
            </div>
          </div>
        </div>
        {canLog || saved ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => model.personId && run(() => toggleFavorite(model.personId!))}
            className="shrink-0 rounded-[8px] p-1.5 transition-colors"
            style={{ color: model.favorite ? "#F0C94A" : "var(--faint)" }}
            aria-label={model.favorite ? "Unfavorite" : "Favorite"}
            title={model.favorite ? "Favorited" : "Favorite"}
          >
            <Star size={16} fill={model.favorite ? "#F0C94A" : "none"} />
          </button>
        ) : null}
      </div>

      {model.description ? <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">{model.description}</p> : null}

      {model.whyThisPerson ? (
        <div>
          <Label>Why this person</Label>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--body)]">{model.whyThisPerson}</p>
          {model.sourceEvidence.length ? (
            <button type="button" onClick={() => setExpanded(expanded === "sources" ? "none" : "sources")} className="mt-1 text-[11px] text-[var(--accent)] underline decoration-dotted">
              {expanded === "sources" ? "Hide sources" : `${model.sourceEvidence.length} source${model.sourceEvidence.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
          {expanded === "sources" ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {model.sourceEvidence.map((e, i) => (
                <li key={i} className="text-[11.5px] text-[var(--faint)]">
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline decoration-dotted">
                      {e.kind.replace(/_/g, " ")} ↗
                    </a>
                  ) : (
                    e.kind
                  )}
                  {e.excerpt ? <span className="ml-1">— “{e.excerpt.slice(0, 140)}”</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {model.whyNow ? (
        <div className="why-now">
          <span className="diamond mt-[6px]" style={{ width: 4, height: 4 }} />
          <span className="text-[12.5px] leading-[1.5] text-[var(--muted)]">
            <span className="mr-2 text-[10px] uppercase" style={{ letterSpacing: ".16em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}>
              Why now
            </span>
            {model.whyNow}
          </span>
        </div>
      ) : null}

      {model.useCase || model.trialNctId || model.signalHeadline ? (
        <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--faint)]">
          {model.useCase ? <Pill tone="info">Use case: {model.useCase}</Pill> : null}
          {model.trialNctId ? <Pill tone="neutral">Trial {model.trialNctId}</Pill> : null}
        </div>
      ) : null}

      <RelevanceScore model={model} />

      <EmailBlock
        model={model}
        expanded={expanded === "email"}
        onToggle={() => setExpanded(expanded === "email" ? "none" : "email")}
        emailValue={emailValue}
        setEmailValue={setEmailValue}
        pending={pending}
        onSave={() => model.personId && run(() => updateContactEmail(model.personId!, emailValue))}
      />

      {model.pendingConflicts.length ? (
        <div className="rounded-[8px] border p-2.5 text-[11.5px]" style={{ borderColor: "rgba(240,166,106,.35)", background: "rgba(240,166,106,.08)", color: "#F0A66A" }}>
          {model.pendingConflicts.map((c) => (
            <div key={c.field} className="flex items-center justify-between gap-2">
              <span>
                A refresh found a different <b>{c.field}</b>: “{c.discoveredValue}”.
              </span>
              <span className="flex gap-1.5 shrink-0">
                <button type="button" onClick={() => model.personId && run(() => resolveConflict(model.personId!, c.field, "discovered"))} className="underline">Use new</button>
                <button type="button" onClick={() => model.personId && run(() => resolveConflict(model.personId!, c.field, "current"))} className="underline">Keep mine</button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--card-border)" }}>
        {!saved ? (
          <ActionButton primary disabled={pending} onClick={() => model.discoveredContactId && run(() => addToTracker(model.discoveredContactId!))}>
            Add to tracker
          </ActionButton>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px]" style={{ color: "#A8E6C9", background: "rgba(110,224,184,.1)" }}>
            <Check size={13} /> Added
          </span>
        )}
        {canLog ? (
          <ActionButton
            disabled={pending}
            onClick={() => {
              if (expanded === "draft") {
                setExpanded("none");
              } else {
                setDraftId(null); // DraftPanel generates a fresh one on mount
                setExpanded("draft");
              }
            }}
          >
            Draft email
          </ActionButton>
        ) : null}
        {model.email ? (
          <>
            <ActionButton onClick={() => navigator.clipboard?.writeText(model.email!)}>Copy email</ActionButton>
            <a href={`mailto:${model.email}`}>
              <ActionButtonLink>Open email app</ActionButtonLink>
            </a>
          </>
        ) : null}
        {model.professionalProfileUrl ? (
          <a href={model.professionalProfileUrl} target="_blank" rel="noreferrer">
            <ActionButtonLink>
              Open profile <ExternalLink size={11} />
            </ActionButtonLink>
          </a>
        ) : null}
        {canLog ? (
          <button
            type="button"
            onClick={() => setExpanded(expanded === "history" ? "none" : "history")}
            className="ml-auto inline-flex items-center gap-1 text-[12px] text-[var(--muted)] hover:text-[var(--fg)]"
          >
            Log / history {expanded === "history" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : null}
      </div>

      {saved && model.personId ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase text-[var(--faint)]" style={{ letterSpacing: ".12em", fontFamily: "var(--font-mono)" }}>
            Status
          </span>
          <select
            defaultValue={model.outreachStatus}
            disabled={pending}
            onChange={(e) => run(() => updateOutreachStatus(model.personId!, e.target.value))}
            className="rounded-[8px] border bg-transparent px-2 py-1 text-[12px] text-[var(--fg)]"
            style={{ borderColor: "var(--card-border)" }}
          >
            {OUTREACH_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          {model.lastContactedAt ? <span className="text-[11px] text-var-faint text-[var(--faint)]">Last contacted {model.lastContactedAt.slice(0, 10)}</span> : null}
        </div>
      ) : null}

      {expanded === "draft" && canLog ? <DraftPanel personId={model.personId!} draftId={draftId} onDraftId={setDraftId} /> : null}
      {expanded === "history" && canLog ? <LogPanel personId={model.personId!} onLogged={() => onChanged?.()} logAction={logOutreach} /> : null}

      {msg ? <p className="text-[11.5px] text-[var(--muted)]">{msg}</p> : null}
      {model.lastResearchedAt ? (
        <p className="text-[10.5px] text-[var(--faint)]">Last researched {model.lastResearchedAt.slice(0, 10)}</p>
      ) : null}
    </div>
  );
}

function Headshot({ model }: { model: ContactViewModel }) {
  const [broken, setBroken] = useState(false);
  if (model.headshotUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable source; never proxied/generated
      <img
        src={model.headshotUrl}
        alt={model.name}
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
        style={{ border: "1px solid var(--card-border)" }}
      />
    );
  }
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-medium"
      style={{ background: "rgba(150,185,255,.12)", color: "var(--accent)" }}
      aria-hidden
    >
      {initials(model.name)}
    </div>
  );
}

function RelevanceScore({ model }: { model: ContactViewModel }) {
  const [open, setOpen] = useState(false);
  if (model.relevanceScore == null) return null;
  return (
    <div className="rounded-[8px] border p-2.5" style={{ borderColor: "var(--card-border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-[var(--faint)]" style={{ letterSpacing: ".14em", fontFamily: "var(--font-mono)" }}>
          Relevance ranking (not a response likelihood)
        </span>
        <span className="tnum text-[18px] text-[var(--fg)]" style={{ fontFamily: "var(--font-serif)" }}>{model.relevanceScore}</span>
      </div>
      {model.relevanceBreakdown ? (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[11px] text-[var(--accent)] underline decoration-dotted">
          {open ? "Hide breakdown" : "See breakdown"}
        </button>
      ) : null}
      {open && model.relevanceBreakdown ? (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-[var(--muted)]">
          {Object.entries(model.relevanceBreakdown).map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span>{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
              <span className="tnum">{v}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EmailBlock({
  model, expanded, onToggle, emailValue, setEmailValue, pending, onSave,
}: {
  model: ContactViewModel; expanded: boolean; onToggle: () => void;
  emailValue: string; setEmailValue: (v: string) => void; pending: boolean; onSave: () => void;
}) {
  return (
    <div className="rounded-[8px] border p-2.5" style={{ borderColor: "var(--card-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Mail size={13} className="text-[var(--faint)] shrink-0" />
          <span className="truncate text-[12.5px] text-[var(--fg)]">{model.email ?? "Email not found"}</span>
        </div>
        <Pill tone={PROVENANCE_TONE[model.emailProvenance]}>{EMAIL_PROVENANCE_TEXT[model.emailProvenance]}</Pill>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--faint)]">
        <span>{EMAIL_DELIVERABILITY_TEXT[model.emailDeliverability]}</span>
        {model.emailPattern ? <span>· pattern “{model.emailPattern}”</span> : null}
        {model.emailSupportingCount ? <span>· {model.emailSupportingCount} supporting example{model.emailSupportingCount === 1 ? "" : "s"}</span> : null}
      </div>
      {model.emailNote ? <p className="mt-1 text-[10.5px] italic text-[var(--faint)]">{model.emailNote}</p> : null}
      {model.personId ? (
        <button type="button" onClick={onToggle} className="mt-1.5 text-[11px] text-[var(--accent)] underline decoration-dotted">
          {expanded ? "Cancel" : "Correct email"}
        </button>
      ) : null}
      {expanded ? (
        <div className="mt-2 flex gap-2">
          <input
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="name@company.com"
            className="min-w-0 flex-1 rounded-[8px] border bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--fg)] outline-none"
            style={{ borderColor: "var(--card-border)" }}
          />
          <button type="button" disabled={pending} onClick={onSave} className="rounded-[8px] px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}>
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase" style={{ letterSpacing: ".14em", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
      {children}
    </span>
  );
}

function ActionButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60"
      style={primary ? { background: "var(--accent-btn)", color: "var(--accent-btn-ink)" } : { border: "1px solid var(--card-border)", color: "var(--muted)" }}
    >
      {children}
    </button>
  );
}

function ActionButtonLink({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]" style={{ borderColor: "var(--card-border)" }}>
      {children}
    </span>
  );
}
