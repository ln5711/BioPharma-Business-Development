import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Data table inside a translucent card — hairline row dividers, no zebra,
 * a faint hover wash. Scrolls inside its own container.
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
            <tr
              className="border-b"
              style={{ borderColor: "var(--hairline)", background: "rgba(150,185,255,.04)" }}
            >
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
        "px-4 py-3 text-[9.5px] font-semibold uppercase text-[var(--faint)]",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      style={{ letterSpacing: ".14em", fontFamily: "var(--font-mono)" }}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr
      className="border-b transition-colors last:border-0 hover:bg-[rgba(150,185,255,.04)]"
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
