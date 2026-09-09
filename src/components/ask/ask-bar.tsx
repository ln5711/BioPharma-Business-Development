"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";

interface AskCard {
  kind: string;
  title: string;
  subtitle?: string;
  why?: string[];
  eventDate?: string | null;
  eventDateKind?: string | null;
  actions: { label: string; href: string }[];
}
interface AskSource {
  kind: "workspace_record" | "external" | "interpretation";
  label: string;
  url: string | null;
  date: string | null;
}
interface AskResponse {
  status: "ok" | "no_results" | "unavailable" | "error";
  mode: string;
  answer: string;
  cards: AskCard[];
  sources: AskSource[];
  conversationId: string | null;
}

type PanelState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "answer"; data: AskResponse }
  | { phase: "error"; message: string };

const HOME_SUGGESTIONS = [
  "What changed at Novartis this week?",
  "Find recruiting KRAS G12D trials in pancreatic cancer",
  "Which follow-ups are overdue?",
  "What should I focus on today?",
];

function isAskResponse(v: unknown): v is AskResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.answer === "string" &&
    Array.isArray(o.cards) &&
    Array.isArray(o.sources) &&
    typeof o.status === "string"
  );
}

export function AskBar({ variant }: { variant: "home" | "header" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text) return;

      // Cancel any in-flight request; only the newest response wins.
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      const seq = ++seqRef.current;

      setOpen(true);
      setState({ phase: "loading" });

      const prevCards =
        state.phase === "answer"
          ? state.data.cards.map((c) => ({ title: c.title, href: c.actions[0]?.href ?? "" }))
          : undefined;

      const timeout = setTimeout(() => ctl.abort(), 60_000);
      try {
        const r = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q: text, path: pathname, conversationId, previousCards: prevCards }),
          signal: ctl.signal,
        });

        if (seq !== seqRef.current) return; // a newer request superseded this one

        if (r.status === 401) {
          router.push("/welcome");
          return;
        }
        if (r.status === 429) {
          const body = await r.json().catch(() => ({}));
          setState({ phase: "error", message: body?.error ?? "Too many requests — try again in a minute." });
          return;
        }

        let body: unknown;
        try {
          body = await r.json();
        } catch {
          setState({ phase: "error", message: "newwin returned an unreadable response." });
          return;
        }

        if (!r.ok && !isAskResponse(body)) {
          const msg =
            (body as { error?: string })?.error ??
            `Ask newwin failed (${r.status}). Database search still works.`;
          setState({ phase: "error", message: msg });
          return;
        }
        if (!isAskResponse(body)) {
          setState({ phase: "error", message: "newwin returned an unexpected response shape." });
          return;
        }

        if (body.conversationId) setConversationId(body.conversationId);
        setState({ phase: "answer", data: body });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // cancelled / superseded
        if (seq !== seqRef.current) return;
        setState({ phase: "error", message: "Couldn't reach newwin. Check your connection and retry." });
      } finally {
        clearTimeout(timeout);
      }
    },
    [pathname, conversationId, router, state],
  );

  const reset = () => {
    abortRef.current?.abort();
    setOpen(false);
    setState({ phase: "idle" });
  };
  const newConversation = () => {
    setConversationId(null);
    setState({ phase: "idle" });
    setQ("");
  };

  const inputEl = (
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder={
        variant === "header" ? "Ask newwin — a company, trial, or what changed" : "Ask about a company, trial, biomarker, or your day"
      }
      className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
    />
  );

  if (variant === "header") {
    return (
      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(q);
          }}
          className="flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 transition-colors focus-within:border-[var(--accent-border)]"
          style={{ background: "var(--panel-2)", borderColor: "var(--hairline)" }}
        >
          <Sparkles size={14} className="text-[var(--accent)]" />
          {inputEl}
        </form>
        {open ? (
          <ResultPanel
            state={state}
            conversationId={conversationId}
            onClose={reset}
            onNew={newConversation}
            onFollowUp={run}
            className="right-0 top-[calc(100%+8px)] w-[min(620px,calc(100vw-2rem))]"
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
          placeholder="Ask about a company, trial, biomarker, or your day"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
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
            style={{ borderColor: "var(--card-border)" }}
          >
            {s}
          </button>
        ))}
      </div>
      {open ? (
        <ResultPanel
          state={state}
          conversationId={conversationId}
          onClose={reset}
          onNew={newConversation}
          onFollowUp={run}
          className="left-0 top-[calc(100%+10px)] w-full"
        />
      ) : null}
    </div>
  );
}

function ResultPanel({
  state,
  conversationId,
  onClose,
  onNew,
  onFollowUp,
  className,
}: {
  state: PanelState;
  conversationId: string | null;
  onClose: () => void;
  onNew: () => void;
  onFollowUp: (q: string) => void;
  className: string;
}) {
  const [followUp, setFollowUp] = useState("");

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className={`panel-glass fade-in absolute z-30 max-h-[74vh] overflow-y-auto p-4 ${className}`}>
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Ask newwin{conversationId ? " · conversation saved" : ""}
          </span>
          <div className="flex items-center gap-2">
            {conversationId ? (
              <button onClick={onNew} className="text-[11px] text-[var(--muted)] hover:text-[var(--fg)]">
                New
              </button>
            ) : null}
            <button onClick={onClose} aria-label="Close">
              <X size={13} className="text-[var(--muted)]" />
            </button>
          </div>
        </div>

        {state.phase === "loading" ? (
          <div className="flex items-center gap-3 py-6 text-[13px] text-[var(--muted)]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Understanding the question, retrieving records, composing an answer…
          </div>
        ) : state.phase === "error" ? (
          <p className="py-4 text-[13px] text-[var(--danger)]">{state.message}</p>
        ) : state.phase === "answer" ? (
          <Answer data={state.data} onClose={onClose} />
        ) : (
          <p className="py-4 text-[13px] text-[var(--muted)]">Ask a question to begin.</p>
        )}

        {state.phase === "answer" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (followUp.trim()) {
                onFollowUp(followUp);
                setFollowUp("");
              }
            }}
            className="mt-3 flex items-center gap-2 border-t pt-3"
            style={{ borderColor: "var(--hairline)" }}
          >
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Follow up — e.g. Only Phase 2, or What about pancreatic cancer?"
              className="min-w-0 flex-1 rounded-[9px] border px-3 py-2 text-[12.5px] text-[var(--fg)] outline-none placeholder:text-[var(--placeholder)]"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)" }}
            />
            <button
              type="submit"
              className="rounded-[9px] px-3 py-2 text-[12px] font-semibold"
              style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
            >
              Ask
            </button>
          </form>
        ) : null}
      </div>
    </>
  );
}

function Answer({ data, onClose }: { data: AskResponse; onClose: () => void }) {
  const externalSources = data.sources.filter((s) => s.kind === "external");
  const interpretation = data.sources.find((s) => s.kind === "interpretation");

  return (
    <div>
      {data.status === "unavailable" ? (
        <div
          className="mb-2 rounded-[8px] border px-3 py-2 text-[12px] text-[var(--warn)]"
          style={{ borderColor: "var(--warn)", background: "var(--warn-bg)" }}
        >
          AI features unavailable — showing database results only.
        </div>
      ) : null}

      <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[var(--body)]">{data.answer}</p>

      {data.cards.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {data.cards.map((c, i) => (
            <div
              key={i}
              className="rounded-[12px] border p-3.5"
              style={{ borderColor: "var(--card-border)", background: "var(--panel)" }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {c.kind}
              </div>
              <div className="mt-1.5 text-[14px] text-[var(--fg)]">{c.title}</div>
              {c.subtitle ? (
                <div className="mt-0.5 text-[12px] text-[var(--muted)]">{c.subtitle}</div>
              ) : null}
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
              <div className="mt-2.5 flex flex-wrap gap-2">
                {c.actions.map((a, j) => {
                  const external = /^https?:\/\//.test(a.href);
                  return external ? (
                    <a
                      key={j}
                      href={a.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[8px] border px-3 py-1.5 text-[12px]"
                      style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                    >
                      {a.label} ↗
                    </a>
                  ) : (
                    <Link
                      key={j}
                      href={a.href}
                      onClick={onClose}
                      className="rounded-[8px] border px-3 py-1.5 text-[12px]"
                      style={{
                        borderColor: "var(--accent-border)",
                        background: "var(--accent-tint)",
                        color: "var(--accent)",
                      }}
                    >
                      {a.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {externalSources.length > 0 ? (
        <div className="mt-3">
          <div
            className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Current external sources
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {externalSources.map((s, i) => (
              <li key={i} className="text-[12px]">
                <a
                  href={s.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] underline decoration-dotted"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {interpretation ? (
        <p className="mt-3 text-[11px] italic text-[var(--faint)]">{interpretation.label}</p>
      ) : null}
    </div>
  );
}
