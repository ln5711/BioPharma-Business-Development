"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { RECOMMENDED_PRIORITIES } from "@/lib/priorities";
import { completeOnboarding, type AuthResult } from "./actions";

/**
 * Shown to a signed-in user who hasn't finished onboarding. No animated intro,
 * no name/email/password — just the priorities step. Completing it stamps
 * `onboardedAt`; it never re-registers the account.
 */
export function CompleteOnboarding({ userName }: { userName: string }) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(
    completeOnboarding,
    null,
  );
  const [picked, setPicked] = useState<string[]>(["trials", "outreach"]);
  const [customs, setCustoms] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const addCustom = () => {
    const v = draft.trim();
    if (v && !customs.includes(v)) setCustoms((c) => [...c, v]);
    setDraft("");
  };

  return (
    <div className="dark-scope pulsar-shell grid min-h-dvh place-items-center px-6 py-16">
      <form action={action} className="panel-glass w-full max-w-[520px] p-7">
        {picked.map((id) => (
          <input key={id} type="hidden" name="recommendedIds" value={id} />
        ))}
        {customs.map((c) => (
          <input key={c} type="hidden" name="customPriorities" value={c} />
        ))}
        <input type="hidden" name="customDraft" value={draft} />

        <div
          className="text-[10.5px] uppercase"
          style={{ letterSpacing: ".26em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}
        >
          Finish setting up
        </div>
        <h1
          className="mt-3 text-[26px]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 300, color: "#F5F8FF" }}
        >
          Welcome, {userName.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-[13.5px] text-[#B7BFD8]">
          Pick what newwin should weigh when it ranks your day. You can change this any time in
          Settings.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {RECOMMENDED_PRIORITIES.map((pr) => {
            const on = picked.includes(pr.id);
            return (
              <button
                key={pr.id}
                type="button"
                onClick={() => toggle(pr.id)}
                className="rounded-full border px-3.5 py-2 text-[12.5px] transition-colors"
                style={{
                  borderColor: on ? "rgba(143,211,255,.5)" : "rgba(150,185,255,.18)",
                  background: on ? "rgba(143,211,255,.16)" : "transparent",
                  color: on ? "#DDF1FF" : "#AEB6D0",
                }}
              >
                {pr.short}
              </button>
            );
          })}
        </div>

        {customs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {customs.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                style={{
                  borderColor: "rgba(143,211,255,.35)",
                  background: "rgba(143,211,255,.1)",
                  color: "#CDE9FF",
                }}
              >
                {c}
                <button type="button" onClick={() => setCustoms((x) => x.filter((y) => y !== c))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add your own — e.g. Track KRAS G12C resistance"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={addCustom}
            className="grid w-11 shrink-0 place-items-center rounded-[11px] border"
            style={{ borderColor: "rgba(150,185,255,.18)", color: "#CDE9FF" }}
          >
            <Plus size={15} />
          </button>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-[12.5px]" style={{ color: "#F0866A" }}>
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] px-4 py-3.5 text-[14px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
        >
          {pending ? "Saving…" : "Go to newwin"} <ArrowRight size={15} />
        </button>
      </form>
    </div>
  );
}
