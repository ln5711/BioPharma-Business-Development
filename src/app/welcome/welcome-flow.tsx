"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PulsarMark } from "@/components/brand/pulsar-mark";
import { completeOnboarding, type OnboardingResult } from "./actions";

type Stage = "intro" | "leaving" | "form";

/**
 * First-run: a brief pulsar intro (the mark draws in, holds, then lifts away),
 * then the sign-in / onboarding card. Everything gates on prefers-reduced-motion
 * through the CSS.
 */
export function WelcomeFlow({ initialName }: { initialName: string }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(
    completeOnboarding,
    null,
  );

  useEffect(() => {
    if (stage !== "intro") return;
    const hold = setTimeout(() => setStage("leaving"), 2100);
    return () => clearTimeout(hold);
  }, [stage]);

  useEffect(() => {
    if (stage !== "leaving") return;
    const swap = setTimeout(() => setStage("form"), 640);
    return () => clearTimeout(swap);
  }, [stage]);

  if (stage === "intro" || stage === "leaving") {
    return (
      <div
        className="pulsar-shell grid min-h-dvh place-items-center px-6"
        style={{ color: "#F1F6FF" }}
      >
        <div
          className={stage === "leaving" ? "fade-slide-up" : "fade-slide-in"}
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
            className="mt-3 text-[10.5px] uppercase"
            style={{ letterSpacing: ".3em", color: "#7E8CB8", fontFamily: "var(--font-mono)" }}
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
        <span
          className="text-[19px] text-[#EDF2FF]"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: ".03em" }}
        >
          newwin
        </span>
      </div>

      <div className="mx-auto grid min-h-dvh max-w-[960px] grid-cols-1 items-center gap-10 px-6 py-24 md:grid-cols-[1fr_minmax(320px,420px)]">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase"
            style={{ letterSpacing: ".28em", color: "#7E8CB8", fontFamily: "var(--font-mono)" }}
          >
            Welcome to newwin
          </div>
          <h1
            className="mt-4"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 300,
              fontSize: "clamp(28px,3.4vw,44px)",
              lineHeight: 1.12,
              letterSpacing: "-.01em",
              color: "#F2F6FF",
            }}
          >
            Your territory, mapped and ranked before you open it.
          </h1>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.68] text-[var(--muted)]">
            Every trial amendment, publication, personnel move and financing event
            across your monitored oncology universe arrives deduplicated, scored
            and sequenced — so the first thing you see each morning is the one
            thing worth doing first.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            {[
              "One ranked queue, not eleven inboxes — signals arrive scored and sequenced.",
              "Every recommendation shows the evidence and the reasoning behind it.",
              "Nothing sends, syncs or closes without your explicit approval.",
            ].map((p) => (
              <div key={p} className="flex items-start gap-3">
                <span className="diamond mt-[6px]" />
                <span className="text-[13.5px] leading-[1.55] text-[#B7BFD8]">{p}</span>
              </div>
            ))}
          </div>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="panel-glass fade-slide-in p-7"
        >
          <div
            className="text-[10.5px] uppercase"
            style={{ letterSpacing: ".26em", color: "#8FD3FF", fontFamily: "var(--font-mono)" }}
          >
            Set up your day
          </div>
          <div
            className="mt-3 text-[22px]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 300, color: "#F2F6FF" }}
          >
            Let&rsquo;s set up your day.
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-[#8B94B4]">
            Your name personalises the briefing; your priorities decide the order
            it arrives in.
          </p>

          <div className="mt-6 flex flex-col gap-[15px]">
            <Field label="Your name">
              <input name="name" required defaultValue={initialName} maxLength={120} className={inputCls} />
            </Field>
            <Field label="Your position / role">
              <input
                name="position"
                required
                placeholder="Director, Business Development"
                maxLength={160}
                className={inputCls}
              />
            </Field>
            <Field label="What should lead your week?">
              <textarea
                name="weeklyAim"
                required
                rows={2}
                placeholder="One or two sentences on your focus"
                maxLength={600}
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </Field>
            <Field label="Your top 3 goals">
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <input
                    key={i}
                    name={`goal${i}`}
                    required={i === 1}
                    placeholder={`Goal ${i}`}
                    maxLength={200}
                    className={inputCls}
                  />
                ))}
              </div>
            </Field>
          </div>

          {state && !state.ok ? (
            <p className="mt-4 text-[12.5px] text-[#F0866A]">{state.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] px-4 py-3.5 text-[14px] font-semibold disabled:opacity-60"
            style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)", boxShadow: "var(--accent-btn-shadow)" }}
          >
            {pending ? "Entering…" : "Enter the map"} <ArrowRight size={15} />
          </button>
          <div className="mt-3 text-center text-[11.5px] text-[var(--dim)]">
            Workspace: Predicine (demo)
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-[11px] border border-[rgba(150,185,255,.18)] bg-[rgba(10,8,22,.6)] px-3.5 py-3 text-[14px] text-[#EDF1FC] outline-none transition-colors placeholder:text-[#6B7398] focus:border-[var(--accent-border)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-[7px] block text-[10.5px] uppercase"
        style={{ letterSpacing: ".2em", color: "#7E8CB8", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
