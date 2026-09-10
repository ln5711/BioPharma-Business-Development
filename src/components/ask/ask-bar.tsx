"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import {
  saveTrialToWorkspace,
  monitorTopic,
  saveLead,
  type ActionResult,
} from "@/app/(app)/research-actions";

interface AskSave {
  kind: "trial" | "watchlist" | "lead";
  label: string;
  payload: Record<string, string>;
}
interface AskCard {
  kind: string;
  title: string;
  subtitle?: string;
  why?: string[];
  origin?: "public" | "workspace";
  save?: AskSave;
  actions: { label: string; href: string }[];
}
interface AskSource {
  kind: "workspace_record" | "external" | "interpretation";
  label: string;
  url: string | null;
}
interface AskResponse {
  answer: string;
  workspaceNote?: string | null;
  cards: AskCard[];
  sources?: AskSource[];
  suggestions?: string[];
  status?: "ok" | "no_results" | "unavailable" | "error";
  mode?: string;
  meta?: { synthesis?: string; synthesisError?: string | null };
}

/** Coerce any API payload into something the panel can always render. */
function normalize(status: number, body: unknown): AskResponse {
  const o = (body ?? {}) as Record<string, unknown>;
  if (typeof o.answer === "string") {
    return {
      answer: o.answer,
      workspaceNote: typeof o.workspaceNote === "string" ? o.workspaceNote : null,
      cards: Array.isArray(o.cards) ? (o.cards as AskCard[]) : [],
      sources: Array.isArray(o.sources) ? (o.sources as AskSource[]) : [],
      suggestions: Array.isArray(o.suggestions) ? (o.suggestions as string[]) : [],
      status: (o.status as AskResponse["status"]) ?? "ok",
      mode: typeof o.mode === "string" ? o.mode : undefined,
      meta: (o.meta as AskResponse["meta"]) ?? undefined,
    };
  }
  // Non-standard payload (error envelope, etc.) — surface it honestly.
  const err = typeof o.error === "string" ? o.error : null;
  return {
    answer:
      err ??
      (status === 429
        ? "You're asking a lot, fast — try again in a minute."
        : status >= 500
          ? "Ask newwin hit an error. Database pages still work — try the Intelligence or Trials tabs."
          : "newwin couldn't complete that search."),
    cards: [],
    sources: [],
    status: "error",
  };
}

const HOME_SUGGESTIONS = [
  "What changed overnight?",
  "What should I focus on today?",
  "Which companies should I contact?",
  "What trials changed this week?",
  "Show overdue outreach",
];

/**
 * Ask newwin. Inherits page context from the pathname (an account page → that
 * account, a trial page → that trial). Returns actionable cards, not just prose.
 */
export function AskBar({ variant }: { variant: "home" | "header" }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResponse | null>(null);

  async function run(question: string) {
    const text = question.trim();
    if (!text) return;
    setLoading(true);
    setOpen(true);
    setRes(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: text, path: pathname }),
      });
      if (r.status === 401) {
        // Session expired mid-session → send to sign in rather than a dead panel.
        window.location.href = "/welcome";
        return;
      }
      const body = await r.json().catch(() => null);
      setRes(normalize(r.status, body));
    } catch {
      setRes({
        answer: "Couldn't reach newwin — check your connection and try again.",
        cards: [],
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  if (variant === "header") {
    return (
      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(q);
          }}
          className="flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 transition-colors focus-within:border-[var(--accent-border)]"
          style={{ background: "rgba(150,185,255,.06)", borderColor: "rgba(150,185,255,.14)" }}
        >
          <Sparkles size={14} className="text-[var(--accent)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask newwin — what are you working on?"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]"
          />
        </form>
        {open ? (
          <ResultPanel
            loading={loading}
            res={res}
            onClose={() => setOpen(false)}
            onAsk={(s) => {
              setQ(s);
              run(s);
            }}
            className="right-0 top-[calc(100%+8px)] w-[min(560px,calc(100vw-2rem))]"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="panel-glass flex items-center gap-3 px-4 py-3.5 transition-colors focus-within:border-[var(--accent-border)]"
      >
        <Sparkles size={18} className="text-[var(--accent)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What are you working on?"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold"
          style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
        >
          Ask <ArrowRight size={13} />
        </button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {HOME_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQ(s);
              run(s);
            }}
            className="rounded-full border px-3 py-1.5 text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            style={{ borderColor: "rgba(150,185,255,.16)" }}
          >
            {s}
          </button>
        ))}
      </div>
      {open ? (
        <ResultPanel
          loading={loading}
          res={res}
          onClose={() => setOpen(false)}
          onAsk={(s) => {
            setQ(s);
            run(s);
          }}
          className="left-0 top-[calc(100%+10px)] w-full"
        />
      ) : null}
    </div>
  );
}

const MONO_LABEL: CSSProperties = {
  letterSpacing: ".14em",
  fontFamily: "var(--font-mono)",
};

/** Fire the right server action for a card's Save/Monitor/Add-lead button. */
function dispatchSave(save: AskSave): Promise<ActionResult> {
  if (save.kind === "trial") return saveTrialToWorkspace(save.payload);
  if (save.kind === "watchlist") return monitorTopic(save.payload);
  return saveLead(save.payload);
}

function SaveButton({ save }: { save: AskSave }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<ActionResult | null>(null);

  if (done) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px]"
        style={{
          color: done.ok ? "#8FE3B0" : "#F0866A",
          background: done.ok ? "rgba(143,227,176,.1)" : "rgba(240,134,106,.1)",
        }}
      >
        {done.ok ? <Check size={12} /> : null}
        {done.message}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => setDone(await dispatchSave(save).catch(() => ({ ok: false, message: "Couldn't save — try again." }))))}
      className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60"
      style={{ borderColor: "var(--accent-border)", background: "rgba(150,185,255,.1)", color: "var(--accent)" }}
    >
      {pending ? "Saving…" : save.label}
    </button>
  );
}

function CardView({ c, onClose }: { c: AskCard; onClose: () => void }) {
  return (
    <div
      className="rounded-[12px] border p-3.5"
      style={{ borderColor: "var(--card-border)", background: "rgba(150,185,255,.04)" }}
    >
      <div
        className="text-[10px] uppercase"
        style={{ letterSpacing: ".16em", color: "var(--accent)", fontFamily: "var(--font-mono)" }}
      >
        {c.kind}
      </div>
      <div className="mt-1.5 text-[14px] text-[var(--fg)]">{c.title}</div>
      {c.subtitle ? <div className="mt-0.5 text-[12px] text-[var(--muted)]">{c.subtitle}</div> : null}
      {c.why?.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {c.why.map((w, j) => (
            <li key={j} className="flex gap-2 text-[12px] text-[var(--muted)]">
              <span className="diamond mt-[6px]" style={{ width: 3, height: 3 }} />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      {c.actions.length || c.save ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {c.actions.map((a, j) => (
            <Link
              key={j}
              href={a.href}
              onClick={onClose}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors"
              style={{ borderColor: "rgba(143,211,255,.3)", background: "rgba(143,211,255,.1)", color: "#CDE9FF" }}
            >
              {a.label}
            </Link>
          ))}
          {c.save ? <SaveButton save={c.save} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultPanel({
  loading,
  res,
  onClose,
  onAsk,
  className,
}: {
  loading: boolean;
  res: AskResponse | null;
  onClose: () => void;
  onAsk: (q: string) => void;
  className: string;
}) {
  const cards = Array.isArray(res?.cards) ? res!.cards : [];
  const publicCards = cards.filter((c) => c.origin === "public");
  const workspaceCards = cards.filter((c) => c.origin === "workspace");
  const ungrouped = cards.filter((c) => c.origin !== "public" && c.origin !== "workspace");
  const suggestions = (res?.suggestions ?? []).filter(Boolean).slice(0, 4);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className={`panel-glass fade-in absolute z-30 max-h-[70vh] overflow-y-auto p-4 ${className}`}
      >
        {loading ? (
          <div className="py-6 text-center text-[13px] text-[var(--muted)]">
            newwin is looking…
          </div>
        ) : res ? (
          <div>
            {res.status === "unavailable" ? (
              <div
                className="mb-2 rounded-[8px] border px-3 py-2 text-[12px]"
                style={{ borderColor: "rgba(240,166,106,.4)", background: "rgba(240,166,106,.1)", color: "#F0A66A" }}
              >
                Ask newwin AI is unavailable — showing database results only.
              </div>
            ) : null}

            {res.mode === "external+ai" ? (
              <div
                className="mb-1.5 text-[10px] uppercase"
                style={{ letterSpacing: ".14em", color: "var(--accent)", fontFamily: "var(--font-mono)" }}
              >
                Web research
              </div>
            ) : null}

            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[var(--body)]">
              {res.answer}
            </p>

            {res.meta?.synthesis === "failed" ? (
              <div className="mt-2 text-[12px]" style={{ color: "#F0866A" }}>
                The summary step failed{res.meta.synthesisError ? ` (${res.meta.synthesisError})` : ""}.
                The retrieved links are below.
              </div>
            ) : null}

            {(res.sources ?? []).filter((s) => s.kind === "external" && s.url).length > 0 ? (
              <>
                <div
                  className="mt-3 text-[10px] uppercase"
                  style={{ letterSpacing: ".14em", color: "var(--faint)", fontFamily: "var(--font-mono)" }}
                >
                  Current web sources
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {res.sources!
                    .filter((s) => s.kind === "external" && s.url)
                    .map((s, i) => (
                      <li key={i} className="text-[12px]">
                        <a
                          href={s.url!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] underline decoration-dotted"
                        >
                          {s.label} ↗
                        </a>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}

            {res.workspaceNote ? (
              <div
                className="mt-3 rounded-[8px] border px-3 py-2 text-[12px] text-[var(--muted)]"
                style={{ borderColor: "var(--card-border)" }}
              >
                <span className="uppercase" style={{ letterSpacing: ".12em", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                  Your workspace
                </span>{" "}
                {res.workspaceNote}
              </div>
            ) : null}
            {ungrouped.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2.5">
                {ungrouped.map((c, i) => (
                  <CardView key={i} c={c} onClose={onClose} />
                ))}
              </div>
            ) : null}

            {publicCards.length > 0 ? (
              <>
                <div
                  className="mt-3.5 text-[10px] uppercase"
                  style={{ ...MONO_LABEL, color: "var(--accent)" }}
                >
                  Public research
                </div>
                <div className="mt-1.5 flex flex-col gap-2.5">
                  {publicCards.map((c, i) => (
                    <CardView key={i} c={c} onClose={onClose} />
                  ))}
                </div>
              </>
            ) : null}

            {workspaceCards.length > 0 ? (
              <>
                <div
                  className="mt-3.5 text-[10px] uppercase"
                  style={{ ...MONO_LABEL, color: "var(--faint)" }}
                >
                  Your workspace
                </div>
                <div className="mt-1.5 flex flex-col gap-2.5">
                  {workspaceCards.map((c, i) => (
                    <CardView key={i} c={c} onClose={onClose} />
                  ))}
                </div>
              </>
            ) : null}

            {suggestions.length > 0 ? (
              <>
                <div
                  className="mt-3.5 text-[10px] uppercase"
                  style={{ ...MONO_LABEL, color: "var(--faint)" }}
                >
                  Narrow the search
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onAsk(s)}
                      className="rounded-full border px-3 py-1.5 text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                      style={{ borderColor: "rgba(150,185,255,.16)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
