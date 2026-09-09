"use client";

import { useActionState } from "react";
import { logOutreach, type OutreachResult } from "./actions";

/**
 * Records outreach the user has ALREADY sent or made. It never sends a message.
 * If the typed account name is ambiguous, the server returns the candidates and
 * this form asks the user to pick one.
 */
export function LogOutreachForm() {
  const [state, action, pending] = useActionState<OutreachResult | null, FormData>(
    logOutreach,
    null,
  );

  return (
    <form action={action} className="panel-glass mt-3 grid gap-3 p-5 sm:grid-cols-2">
      <input name="contact" placeholder="Contact name" className="input" />
      <input name="account" placeholder="Account (company) — type to match" className="input" />

      {state && !state.ok && state.accountMatches?.length ? (
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-secondary">Which account?</span>
          <select name="accountId" className="input" defaultValue="">
            <option value="" disabled>
              Select the account…
            </option>
            {state.accountMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <input name="subject" placeholder="Subject" className="input sm:col-span-2" />
      <textarea
        name="body"
        rows={3}
        placeholder="What was said / notes…"
        className="input resize-none sm:col-span-2"
      />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <select name="channel" className="input max-w-[140px]" defaultValue="email">
          <option value="email">Email</option>
          <option value="call">Call</option>
          <option value="linkedin">LinkedIn</option>
        </select>

        <label className="flex items-center gap-2 text-[12.5px] text-secondary">
          <input type="checkbox" name="createFollowup" value="1" defaultChecked />
          Create follow-up task in
          <input
            name="followupDays"
            type="number"
            min={1}
            max={30}
            defaultValue={3}
            className="input w-[64px] !py-1.5"
          />
          days
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
        >
          {pending ? "Saving…" : "Log outreach"}
        </button>
      </div>

      {state?.ok ? (
        <p className="text-[12.5px] text-success sm:col-span-2">
          Logged.{state.followupCreated ? " Follow-up task created." : ""}
        </p>
      ) : state && !state.ok && !state.accountMatches ? (
        <p className="text-[12.5px] text-danger sm:col-span-2">{state.error}</p>
      ) : state && !state.ok && state.accountMatches ? (
        <p className="text-[12.5px] text-warn sm:col-span-2">{state.error}</p>
      ) : null}

      <p className="text-[11.5px] text-tertiary sm:col-span-2">
        This records outreach you already sent — it does not send anything.
      </p>
    </form>
  );
}
