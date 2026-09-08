import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial data table — hairline rules, no zebra, no outer box, generous cells,
 * serif entity names. Always scrolls inside its own container.
 */
export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--hairline)" }}>
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
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
        "eyebrow px-3 py-2.5 font-semibold first:pl-1 last:pr-1",
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
        "px-3 py-3.5 align-top first:pl-1 last:pr-1",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
