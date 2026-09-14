import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeCell, toCsv, toXlsx, TRACKER_HEADERS } from "@/lib/contacts/export";

test("CSV escapes commas, quotes and newlines per RFC 4180", () => {
  const csv = toCsv(["A", "B"], [["hello, world", 'She said "hi"'], ["line1\nline2", "plain"]]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "A,B");
  assert.equal(lines[1], '"hello, world","She said ""hi"""');
  assert.equal(lines[2], '"line1\nline2",plain');
});

test("formula-injection guard: a leading = + - @ is neutralised", () => {
  for (const bad of ["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tHIDDEN"]) {
    const safe = sanitizeCell(bad);
    assert.equal(safe[0], "'", `expected a leading quote for ${JSON.stringify(bad)}`);
  }
  // Ordinary values are untouched.
  assert.equal(sanitizeCell("jane.doe@example.com"), "jane.doe@example.com");
  assert.equal(sanitizeCell("Revolution Medicines"), "Revolution Medicines");
  assert.equal(sanitizeCell(42), "42");
  assert.equal(sanitizeCell(null), "");
});

test("a formula-injection payload survives CSV round-trip as inert text", () => {
  const csv = toCsv(["Notes"], [["=1+1"]]);
  assert.ok(csv.includes("'=1+1"), csv);
});

test("XLSX generation never throws and produces a non-trivial buffer", async () => {
  const buf = await toXlsx([
    { name: "Tracker", headers: [...TRACKER_HEADERS], rows: [["Jane", "Doe", "Jane Doe", "=EVIL()", "Acme"]] },
  ]);
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 500);
  // XLSX zip magic header.
  assert.equal(buf.subarray(0, 2).toString("hex"), "504b");
});

test("TRACKER_HEADERS matches the exact fallback column spec, in order", () => {
  assert.deepEqual(
    [...TRACKER_HEADERS],
    [
      "First Name", "Last Name", "Full Name", "Title", "Company", "Department",
      "LinkedIn URL", "Company Profile URL", "Email", "Email Provenance",
      "Email Deliverability", "Email Pattern", "Email Evidence URLs",
      "Relevance Score", "Why This Contact", "Why Now", "Related Signal",
      "Asset", "Trial ID", "Status", "Favorite", "Owner", "Last Contacted",
      "Last Response", "Next Follow-Up", "Outreach Count", "Latest Outcome",
      "Notes", "Source URLs", "Last Researched",
    ],
  );
});
