"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { completeOnboarding, type OnboardingResult } from "./actions";

type Stage = "hello" | "leaving" | "form";

/**
 * First-run welcome. Stage one fades in "Welcome to newwin", holds briefly,
 * then slides up and out; stage two fades in the onboarding form. Fade/slide
 * only — nothing flashy — and it honours prefers-reduced-motion via the CSS.
 */
export function WelcomeFlow({ initialName }: { initialName: string }) {
  const [stage, setStage] = useState<Stage>("hello");
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(
    completeOnboarding,
    null,
  );

  useEffect(() => {
    if (stage !== "hello") return;
    const hold = setTimeout(() => setStage("leaving"), 1900);
    return () => clearTimeout(hold);
  }, [stage]);

  useEffect(() => {
    if (stage !== "leaving") return;
    const swap = setTimeout(() => setStage("form"), 430);
    return () => clearTimeout(swap);
  }, [stage]);

  if (stage === "hello" || stage === "leaving") {
    return (
      <div
        className="grid min-h-dvh place-items-center brand-gradient px-6"
        style={{ color: "var(--color-sky-100)" }}
      >
        <div className={stage === "leaving" ? "fade-slide-up" : "fade-slide-in"}>
          <p
            className="text-center text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--color-blue-400)" }}
          >
            Welcome to
          </p>
          <h1
            className="mt-3 text-center lowercase"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2.75rem, 2rem + 5vw, 4.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            newwin
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <form
        action={formAction}
        className="fade-slide-in w-full max-w-[440px]"
        autoComplete="off"
      >
        <p className="eyebrow mb-2">Let&rsquo;s get you set up</p>
        <h1 className="display-lg">A few quick things</h1>
        <p className="meta mt-2 leading-relaxed">
          This is stored once and won&rsquo;t be asked again. It tailors your
          briefing and the task tracker to what you&rsquo;re working on.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          <Field label="Your name">
            <input
              name="name"
              required
              defaultValue={initialName}
              maxLength={120}
              className={inputCls}
            />
          </Field>
          <Field label="Your position / role">
            <input
              name="position"
              required
              placeholder="e.g. Director, Business Development"
              maxLength={160}
              className={inputCls}
            />
          </Field>
          <Field label="What are you trying to achieve this week?">
            <textarea
              name="weeklyAim"
              required
              rows={3}
              placeholder="One or two sentences on your focus this week"
              maxLength={600}
              className={`${inputCls} resize-none leading-relaxed`}
            />
          </Field>
          <Field label="Your top 3 goals for the week">
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
          <p className="mt-4 text-[12.5px] text-[var(--color-critical)]">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-8 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {pending ? "Saving…" : "Enter newwin"} <ArrowRight size={14} />
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-[var(--radius-sm)] border bg-[var(--panel)] px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
