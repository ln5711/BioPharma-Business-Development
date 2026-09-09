"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteTask, setTaskDone } from "./actions";
import type { TaskRow as Task } from "@/lib/task-categories";

export function TaskRow({ task }: { task: Task }) {
  const [pending, start] = useTransition();

  return (
    <div
      className={cn(
        "group flex items-start gap-3 py-2.5 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <button
        type="button"
        aria-label={task.done ? "Mark incomplete" : "Mark complete"}
        onClick={() => start(() => setTaskDone(task.id, !task.done))}
        className={cn(
          "mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border transition-colors",
          task.done
            ? "border-transparent text-[#06101F]"
            : "border-[var(--faint)] text-transparent hover:border-[var(--accent)]",
        )}
        style={
          task.done
            ? { background: "var(--accent)", boxShadow: "var(--accent-glow)" }
            : undefined
        }
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <span
        className={cn(
          "flex-1 text-[13.5px] leading-relaxed",
          task.done && "text-[var(--faint)] line-through",
        )}
      >
        {task.title}
      </span>

      <button
        type="button"
        aria-label="Delete task"
        onClick={() => start(() => deleteTask(task.id))}
        className="mt-[1px] shrink-0 text-[var(--faint)] opacity-0 transition-opacity hover:text-[var(--color-critical)] group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
