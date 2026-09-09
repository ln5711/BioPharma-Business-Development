"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { addTask } from "./actions";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_META,
  type TaskCategory,
} from "@/lib/task-categories";

export function AddTaskForm({ defaultCategory = "outreach" as TaskCategory }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          await addTask(fd);
          formRef.current?.reset();
          formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
        })
      }
      className="flex flex-wrap items-center gap-2 border-b pb-5"
    >
      <input
        name="title"
        required
        placeholder="Add a task…"
        maxLength={500}
        autoComplete="off"
        className="min-w-[220px] flex-1 rounded-[9px] border border-[var(--hairline)] bg-[var(--input-bg)] px-3 py-2.5 text-[13.5px] text-[var(--fg)] outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent-border)]"
      />
      <select
        name="category"
        defaultValue={defaultCategory}
        className="rounded-[9px] border border-[var(--hairline)] bg-[var(--input-bg)] px-2.5 py-2.5 text-[12.5px] text-[var(--fg)] outline-none focus:border-[var(--accent-border)]"
      >
        {TASK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {TASK_CATEGORY_META[c].label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
        style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
      >
        <Plus size={13} /> Add
      </button>
    </form>
  );
}
