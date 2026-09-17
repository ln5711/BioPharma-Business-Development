import "server-only";
import ExcelJS from "exceljs";

/**
 * CSV/XLSX generation for the outreach tracker. Every cell goes through the
 * same formula-injection guard (OWASP CSV-injection mitigation): a value
 * beginning with `= + - @` or a tab/CR is prefixed with a leading apostrophe
 * so a spreadsheet application treats it as literal text, never a formula.
 */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function csvEscape(value: unknown): string {
  const s = sanitizeCell(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** RFC-4180-ish CSV, CRLF line endings, header row included. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\r\n") + "\r\n";
}

export async function toXlsx(
  sheets: { name: string; headers: string[]; rows: (string | number | null | undefined)[][] }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "newwin";
  wb.created = new Date();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow(sheet.headers);
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      // Force every value to a sanitized STRING cell — never a formula object —
      // so a discovered/inferred value can never execute as a spreadsheet formula.
      ws.addRow(row.map((v) => sanitizeCell(v)));
    }
    ws.columns.forEach((col) => {
      col.width = 22;
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export const TRACKER_HEADERS = [
  "First Name",
  "Last Name",
  "Full Name",
  "Title",
  "Company",
  "Department",
  "LinkedIn URL",
  "Company Profile URL",
  "Email",
  "Email Provenance",
  "Email Deliverability",
  "Email Pattern",
  "Email Evidence URLs",
  "Relevance Score",
  "Why This Contact",
  "Why Now",
  "Related Signal",
  "Asset",
  "Trial ID",
  "Status",
  "Favorite",
  "Owner",
  "Last Contacted",
  "Last Response",
  "Next Follow-Up",
  "Outreach Count",
  "Latest Outcome",
  "Notes",
  "Source URLs",
  "Last Researched",
] as const;

export const ACTIVITIES_HEADERS = [
  "Full Name",
  "Company",
  "Channel",
  "Date",
  "Subject",
  "Message/Notes",
  "Direction",
  "Outcome",
  "Next Step",
] as const;

export const SALESFORCE_LEAD_HEADERS = [
  "First Name",
  "Last Name",
  "Company",
  "Title",
  "Email",
  "Lead Source",
  "Description",
  "Website",
  "Status",
] as const;

/** Required Salesforce Lead fields — used to flag rows that will fail import. */
export const SALESFORCE_REQUIRED = ["Last Name", "Company"] as const;
