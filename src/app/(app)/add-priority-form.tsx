"use client";

import { useActionState, useEffect, useRef } from "react";
import { addQuickPriority, type QuickPriorityResult } from "./home-actions";

/**
 * Adds a real saved priority from Home. On success the server revalidates and
 * the new priority appears in the list below; on a validation problem (blank,
 * duplicate, over the limit) the message is shown inline — the entered text is
 * never silently dropped.
 */
export function AddPriorityForm() {
  const [state, action, pending] = useActionState<QuickPriorityResult | null, FormData>(
    addQuickPriority,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="mt-6">
      <form ref={formRef} action={action} className="flex gap-2">
        <input
          name="text"
          required
          minLength={2}
          maxLength={200}
          placeholder="Add a priority for newwin to weigh — e.g. Track KRAS G12C resistance"
          className="input flex-1"
          aria-label="New priority"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[11px] border border-default px-4 py-3 text-[12.5px] text-accent-fg disabled:opacity-60"
          style={{ background: "var(--accent-tint)", borderColor: "var(--accent-border)" }}
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="mt-2 text-[12px] text-danger">{state.error}</p>
      ) : (
        <p className="mt-2 text-[12px] text-tertiary">
          Priorities influence which signals, trials and accounts get surfaced. Manage them in{" "}
          <a href="/settings" className="text-accent-fg">
            Settings
          </a>
          .
        </p>
      )}
    </div>
  );
}
