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
        className="min-w-[220px] flex-1 rounded-[var(--radius-sm)] border bg-[var(--panel)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--accent)]"
      />
      <select
        name="category"
        defaultValue={defaultCategory}
        className="rounded-[var(--radius-sm)] border bg-[var(--panel)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[var(--accent)]"
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
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        <Plus size={13} /> Add
      </button>
    </form>
  );
}
