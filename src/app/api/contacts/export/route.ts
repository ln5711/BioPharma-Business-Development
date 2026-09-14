import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/tenant";
import { ACTIVITIES_HEADERS, SALESFORCE_LEAD_HEADERS, TRACKER_HEADERS, toCsv, toXlsx } from "@/lib/contacts/export";
import { getActivityRows, getSavedContacts, type SavedContactFilters, type SavedContactRow } from "@/lib/contacts/query-contacts";
import { toActivityRow, toSalesforceLeadRow, toTrackerRow, validateForSalesforce } from "@/lib/contacts/tracker-row";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportBody {
  format: "csv" | "xlsx";
  preset?: "tracker" | "salesforce";
  scope: "selected" | "filtered" | "all";
  personIds?: string[];
  filters?: SavedContactFilters;
  includeInferredEmail?: boolean;
  /** Return a JSON mapping preview instead of a file — no download. */
  preview?: boolean;
}

/**
 * Generates the tracker export from the LATEST persisted state — the same
 * query the Saved/table view uses (see getSavedContacts) — never a stale
 * client-held snapshot. Downloading never mutates any record (no CRM-sync
 * flag is touched here).
 */
export async function POST(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: ExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.format !== "csv" && body.format !== "xlsx") {
    return NextResponse.json({ error: "format must be csv or xlsx" }, { status: 400 });
  }

  const all = await getSavedContacts(auth.tenant.id, { ...body.filters, limit: 5000 });
  let rows: SavedContactRow[] = all;
  if (body.scope === "selected") {
    const ids = new Set(body.personIds ?? []);
    // Cross-tenant guard: `all` is already tenant-scoped, so an id for another
    // tenant's person simply won't be present here.
    rows = all.filter((r) => ids.has(r.person.id));
  }

  const preset = body.preset ?? "tracker";
  const stamp = new Date().toISOString().slice(0, 10);

  if (preset === "salesforce") {
    const includeInferred = Boolean(body.includeInferredEmail);
    const sfRows = rows.map((r) => toSalesforceLeadRow(r, includeInferred));
    const validations = rows.map(validateForSalesforce).filter(Boolean);
    if (body.preview) {
      return NextResponse.json({
        headers: SALESFORCE_LEAD_HEADERS,
        sampleRows: sfRows.slice(0, 5),
        totalRows: sfRows.length,
        requiredFields: ["Last Name", "Company"],
        validations,
        note: "Salesforce Lead import preset — not a guaranteed one-click import; review flagged rows and any org-specific required/custom fields before importing.",
      });
    }
    if (body.format === "csv") {
      const csv = toCsv([...SALESFORCE_LEAD_HEADERS], sfRows);
      return fileResponse(csv, `newwin-salesforce-leads-${stamp}.csv`, "text/csv; charset=utf-8");
    }
    const buf = await toXlsx([{ name: "Leads", headers: [...SALESFORCE_LEAD_HEADERS], rows: sfRows }]);
    return fileResponse(buf, `newwin-salesforce-leads-${stamp}.xlsx`, XLSX_MIME, { "x-mapping-warnings": String(validations.length) });
  }

  const trackerRows = rows.map(toTrackerRow);
  if (body.preview) {
    return NextResponse.json({ headers: TRACKER_HEADERS, sampleRows: trackerRows.slice(0, 5), totalRows: trackerRows.length });
  }
  const activities = await getActivityRows(auth.tenant.id, body.scope === "selected" ? rows.map((r) => r.person.id) : undefined);
  const activityRows = activities.map(toActivityRow);

  if (body.format === "csv") {
    // CSV can only hold one sheet — the tracker. Activities are a second,
    // separate CSV file, as required.
    const csv = toCsv([...TRACKER_HEADERS], trackerRows);
    return fileResponse(csv, `newwin-outreach-tracker-${stamp}.csv`, "text/csv; charset=utf-8");
  }

  const buf = await toXlsx([
    { name: "Tracker", headers: [...TRACKER_HEADERS], rows: trackerRows },
    { name: "Activities", headers: [...ACTIVITIES_HEADERS], rows: activityRows },
  ]);
  return fileResponse(buf, `newwin-outreach-tracker-${stamp}.xlsx`, XLSX_MIME);
}

/** A second endpoint for the separate "Activities" CSV the spec calls out. */
export async function GET(req: Request) {
  const auth = await getOptionalAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("activities") !== "1") {
    return NextResponse.json({ error: "use POST for the tracker export, or ?activities=1 for the activities CSV" }, { status: 400 });
  }
  const rows = (await getActivityRows(auth.tenant.id)).map(toActivityRow);
  const csv = toCsv([...ACTIVITIES_HEADERS], rows);
  return fileResponse(csv, `newwin-outreach-activities-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv; charset=utf-8");
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileResponse(body: string | Buffer, filename: string, contentType: string, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(body as never, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}
