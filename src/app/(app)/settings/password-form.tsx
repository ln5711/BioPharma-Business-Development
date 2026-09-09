"use client";

import { useActionState } from "react";
import { changePassword, type PasswordResult } from "./actions";

/**
 * Change password. On success the server revokes every other session and
 * re-issues one for this device, so other browsers are signed out.
 */
export function PasswordForm({ canChange }: { canChange: boolean }) {
  const [state, action, pending] = useActionState<PasswordResult | null, FormData>(
    changePassword,
    null,
  );

  if (!canChange) {
    return (
      <p className="mt-3 text-[12.5px] text-tertiary">
        This account has no password set (demo / seeded user).
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 grid max-w-[520px] gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-[10.5px] uppercase tracking-[0.18em] text-tertiary">
          Current password
        </span>
        <input name="current" type="password" required className="input" autoComplete="current-password" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10.5px] uppercase tracking-[0.18em] text-tertiary">
          New password
        </span>
        <input
          name="next"
          type="password"
          required
          minLength={8}
          className="input"
          autoComplete="new-password"
        />
      </label>
      <div className="sm:col-span-2">
        {state?.ok ? (
          <p className="mb-2 text-[12.5px] text-success">
            Password changed. Other devices have been signed out.
          </p>
        ) : state && !state.ok ? (
          <p className="mb-2 text-[12.5px] text-danger">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
          style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
        >
          {pending ? "Updating…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
