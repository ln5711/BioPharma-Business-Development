import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Data table inside a white card — hairline row dividers, no zebra, soft hover.
 * Always scrolls inside its own container.
 */
export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}>
              {head}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Th({
  className,
  align = "left",
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      {...rest}
      className={cn(
        "px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr
      className="border-b transition-colors last:border-0 hover:bg-[var(--panel-2)]"
      style={{ borderColor: "var(--hairline)" }}
    >
      {children}
    </tr>
  );
}

export function Td({
  className,
  align = "left",
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td
      {...rest}
      className={cn(
        "px-4 py-3.5 align-top",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
