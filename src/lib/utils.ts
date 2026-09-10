import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner used by every UI primitive. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stable JSON stringify with sorted keys — used for content hashing. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function formatRelativeDays(from: Date | string | null | undefined): string {
  if (!from) return "—";
  const d = typeof from === "string" ? new Date(from) : from;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

/**
 * Absolute calendar date, e.g. "Aug 21, 2026". Formatted in UTC so a
 * ClinicalTrials.gov date ("2026-08-21", stored midnight-UTC) never renders as
 * the day before in a negative-offset timezone.
 */
export function formatDate(from: Date | string | null | undefined): string {
  if (!from) return "—";
  const d = typeof from === "string" ? new Date(from) : from;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Aug 21, 2026 · 20 days ago" — absolute first, then relative for context. */
export function formatDateWithRelative(from: Date | string | null | undefined): string {
  if (!from) return "—";
  return `${formatDate(from)} · ${formatRelativeDays(from)}`;
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
