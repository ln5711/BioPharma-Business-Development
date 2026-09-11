"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { RECOMMENDED_PRIORITIES } from "@/lib/priorities";
import { createAccount, signIn, type AuthResult } from "./actions";

type Phase = "intro" | "leaving" | "form";
type Mode = "create" | "signin";

export function WelcomeFlow() {
  const [phase, setPhase] = useState<Phase>("intro");
  // Signed-out visitors land on Sign in; new users switch to Create.
  const [mode, setMode] = useState<Mode>("signin");

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("leaving"), 2100);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("form"), 640);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase !== "form") {
    return (
      <div className="pulsar-shell grid min-h-dvh place-items-center px-6" style={{ color: "#F1F6FF" }}>
        <div
          className={phase === "leaving" ? "fade-slide-up" : "fade-slide-in"}
          style={{ textAlign: "center" }}
        >
          <div className="flex justify-center">
            <PulsarMark size={128} />
          </div>
          <div
            className="mt-6"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "clamp(30px,4vw,44px)", letterSpacing: ".04em" }}
          >
            newwin
          </div>
          <div
            className="mt-3 text-[11px] uppercase"
            style={{ letterSpacing: ".3em", color: "#9AA3C0", fontFamily: "var(--font-mono)" }}
          >
            Signal intelligence for oncology BD
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pulsar-shell relative min-h-dvh overflow-y-auto">
      <div className="absolute left-7 top-7 flex items-center gap-2.5">
        <PulsarMark size={28} />
        <span className="text-[19px] text-[#EDF2FF]" style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}>
          newwin
        </span>
      </div>

      <div className="mx-auto grid min-h-dvh max-w-[1000px] grid-cols-1 items-center gap-12 px-6 py-24 md:grid-cols-[1fr_minmax(360px,460px)]">
        <div className="min-w-0">
          <div className="text-[11px] uppercase" style={{ letterSpacing: ".28em", color: "#9AA3C0", fontFamily: "var(--font-mono)" }}>
            Welcome to newwin
          </div>
          <h1
            className="mt-4"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "clamp(30px,3.6vw,46px)", lineHeight: 1.12, letterSpacing: "-.01em", color: "#F5F8FF" }}
          >
            Your territory, mapped and ranked before you open it.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15.5px] leading-[1.7] text-[#B7BFD8]">
            Every trial amendment, publication, personnel move and financing event
            across your monitored oncology universe arrives deduplicated, scored
            and sequenced — so the first thing you see each morning is the one
            thing worth doing first.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            {[
              "One ranked queue, not eleven inboxes.",
              "Every recommendation shows the evidence and the reasoning behind it.",
              "Nothing sends, syncs or closes without your explicit approval.",
            ].map((p) => (
              <div key={p} className="flex items-start gap-3">
                <span className="diamond mt-[7px]" />
                <span className="text-[14px] leading-[1.55] text-[#C7CEE4]">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {mode === "create" ? (
          <CreateForm onSignIn={() => setMode("signin")} />
        ) : (
          <SignInForm onCreate={() => setMode("create")} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function CreateForm({ onSignIn }: { onSignIn: () => void }) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(createAccount, null);
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
    <form action={action} className="panel-glass fade-slide-in p-7">
      {picked.map((id) => (
        <input key={id} type="hidden" name="recommendedIds" value={id} />
      ))}
      {customs.map((c) => (
        <input key={c} type="hidden" name="customPriorities" value={c} />
      ))}

      <div className="flex items-center justify-between gap-3">
        <div className="text-[10.5px] uppercase" style={{ letterSpacing: ".26em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}>
          Create account
        </div>
        <button type="button" onClick={onSignIn} className="text-[12px] text-[#9AA3C0] hover:text-white">
          Have an account? Sign in
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <Field label="Your name">
          <input name="name" required maxLength={120} placeholder="Luciann Nguyen" className={inputCls} />
        </Field>
        <Field label="Work email">
          <input name="email" required type="email" placeholder="you@company.com" className={inputCls} />
        </Field>
        <Field label="Password">
          <input name="password" required type="password" minLength={8} placeholder="At least 8 characters" className={inputCls} />
        </Field>

        <div className="my-1 h-px" style={{ background: "rgba(150,185,255,.12)" }} />

        <Field label="Organization / company">
          <input name="orgName" required maxLength={160} placeholder="Predicine" className={inputCls} />
        </Field>
        <Field label="Website / domain">
          <input name="orgDomain" maxLength={160} placeholder="predicine.com" className={inputCls} />
        </Field>

        <div className="my-1 h-px" style={{ background: "rgba(150,185,255,.12)" }} />

        <div>
          <span className={labelCls}>What are you focused on?</span>
          <p className="mt-1 text-[12px] text-[#8B94B4]">Choose what matters right now — you can change this later.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {RECOMMENDED_PRIORITIES.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="rounded-full border px-3.5 py-2 text-[12.5px] transition-colors"
                  style={{
                    borderColor: on ? "rgba(143,211,255,.5)" : "rgba(150,185,255,.18)",
                    background: on ? "rgba(143,211,255,.16)" : "transparent",
                    color: on ? "#DDF1FF" : "#AEB6D0",
                  }}
                >
                  {p.short}
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
                  style={{ borderColor: "rgba(143,211,255,.35)", background: "rgba(143,211,255,.1)", color: "#CDE9FF" }}
                >
                  {c}
                  <button type="button" onClick={() => setCustoms((x) => x.filter((y) => y !== c))} className="opacity-70 hover:opacity-100">
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
              placeholder="Add your own priority — e.g. Track companies developing KRAS inhibitors"
              className={`${inputCls} flex-1`}
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
        </div>
      </div>

      {state && !state.ok ? <p className="mt-4 text-[12.5px] text-[#F0866A]">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] px-4 py-3.5 text-[14px] font-semibold disabled:opacity-60"
        style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)", boxShadow: "var(--accent-btn-shadow)" }}
      >
        {pending ? "Setting up…" : "Enter newwin"} <ArrowRight size={15} />
      </button>
    </form>
  );
}

function SignInForm({ onCreate }: { onCreate: () => void }) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(signIn, null);
  return (
    <form action={action} className="panel-glass fade-slide-in p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10.5px] uppercase" style={{ letterSpacing: ".26em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}>
          Sign in
        </div>
        <button type="button" onClick={onCreate} className="text-[12px] text-[#9AA3C0] hover:text-white">
          Create an account
        </button>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <Field label="Work email">
          <input name="email" required type="email" placeholder="you@company.com" className={inputCls} />
        </Field>
        <Field label="Password">
          <input name="password" required type="password" placeholder="Your password" className={inputCls} />
        </Field>
      </div>
      {state && !state.ok ? <p className="mt-4 text-[12.5px] text-[#F0866A]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] px-4 py-3.5 text-[14px] font-semibold disabled:opacity-60"
        style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)", boxShadow: "var(--accent-btn-shadow)" }}
      >
        {pending ? "Signing in…" : "Sign in"} <ArrowRight size={15} />
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-[11px] border border-[rgba(150,185,255,.2)] bg-[rgba(10,8,22,.55)] px-3.5 py-3 text-[14.5px] text-[#EDF1FC] outline-none transition-colors placeholder:text-[#7A83A6] focus:border-[var(--accent-border)]";
const labelCls =
  "block text-[10.5px] uppercase";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-[7px] block text-[10.5px] uppercase"
        style={{ letterSpacing: ".2em", color: "#AEB6D0", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
