import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIntentHeuristic } from "@/lib/ask/intent";

const ctx = {};

test("outside-world queries default to public_research", () => {
  for (const q of ["KRAS", "Novartis oncology", "Roche bioinformatics leaders", "what changed at Novartis this week?", "KRAS G12C inhibitors 2026"]) {
    assert.equal(parseIntentHeuristic(q, ctx).intent, "public_research", q);
  }
});

test("a bare biomarker is a valid public_research query with entities extracted", () => {
  const i = parseIntentHeuristic("KRAS", ctx);
  assert.equal(i.intent, "public_research");
  assert.ok(i.biomarkers.includes("KRAS"));
});

test("company + topic split, timeframe extracted, still public_research", () => {
  const i = parseIntentHeuristic("What changed at Novartis oncology this week?", ctx);
  assert.equal(i.intent, "public_research");
  assert.ok(i.companies.includes("Novartis"));
  assert.ok(!i.companies.some((c) => /oncology/i.test(c)), "'oncology' must not be glued to the company");
  assert.ok(i.topics.includes("oncology"));
  assert.equal(i.timeframeDays, 7);
});

test("person-role queries capture roles and stay public_research", () => {
  const i = parseIntentHeuristic("Roche bioinformatics leaders", ctx);
  assert.equal(i.intent, "public_research");
  assert.ok(i.companies.includes("Roche"));
  assert.ok(i.personRoles.some((r) => /bioinformatics|leader/.test(r)));
});

test("filters (status / biomarker / indication) are extracted for trial discovery", () => {
  const i = parseIntentHeuristic("recruiting KRAS G12D trials in pancreatic cancer", ctx);
  assert.equal(i.intent, "public_research");
  assert.ok(i.statuses.includes("recruiting"));
  assert.ok(i.biomarkers.includes("KRAS G12D"));
  assert.ok(i.indications.includes("pancreatic"));
});

test("'Only Phase 2' follow-up narrows to phase 2", () => {
  assert.ok(parseIntentHeuristic("Only Phase 2", ctx).phases.includes("2"));
});

test("compare intent with two NCT ids", () => {
  const i = parseIntentHeuristic("Compare NCT12345678 and NCT87654321", ctx);
  assert.equal(i.intent, "compare_trials");
  assert.deepEqual(i.nctIds.sort(), ["NCT12345678", "NCT87654321"]);
});

test("'my …' / overdue follow-ups are PERSONAL and user-scoped", () => {
  assert.equal(parseIntentHeuristic("Which follow-ups are overdue?", ctx).intent, "personal");
  assert.equal(parseIntentHeuristic("Which follow-ups are overdue?", ctx).personalKind, "overdue_tasks");
  assert.equal(parseIntentHeuristic("show my priorities", ctx).personalKind, "priorities");
  assert.equal(parseIntentHeuristic("my contacts at BridgeBio", ctx).personalKind, "contacts");
  // a company mention without a first-person cue is NOT personal
  assert.equal(parseIntentHeuristic("BridgeBio contacts", ctx).intent, "public_research");
});

test("'draft an email about the second result' → draft_outreach + ordinal", () => {
  const i = parseIntentHeuristic("Draft an email about the second result", ctx);
  assert.equal(i.intent, "draft_outreach");
  assert.equal(i.refersToPreviousResult, 2);
});

test("page context fills a missing company but never overrides an explicit one", () => {
  const withCtx = parseIntentHeuristic("what changed recently", {
    contextCompany: { id: "org-1", name: "ContextCo" },
  });
  assert.ok(withCtx.companies.includes("ContextCo"));
  const explicit = parseIntentHeuristic("what changed at Roche recently", {
    contextCompany: { id: "org-1", name: "ContextCo" },
  });
  assert.ok(explicit.companies.includes("Roche"));
  assert.ok(!explicit.companies.includes("ContextCo"));
});

test("wantsExternalResearch flags recency (research runs either way)", () => {
  assert.equal(parseIntentHeuristic("KRAS overview", ctx).wantsExternalResearch, false);
  assert.equal(parseIntentHeuristic("latest Merck KRAS news", ctx).wantsExternalResearch, true);
  assert.equal(parseIntentHeuristic("recent Novartis approvals", ctx).wantsExternalResearch, true);
});
