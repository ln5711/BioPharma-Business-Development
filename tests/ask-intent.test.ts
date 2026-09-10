import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIntentHeuristic } from "@/lib/ask/intent";

const ctx = {};

test("an explicit company + 'this week' does not become a generic feed", () => {
  const i = parseIntentHeuristic("What changed at Novartis this week?", ctx);
  assert.equal(i.intent, "company_developments");
  assert.ok(i.companies.includes("Novartis"));
  assert.equal(i.timeframeDays, 7);
});

test("'today' alone with a company still targets that company", () => {
  const i = parseIntentHeuristic("Any Pfizer news today?", ctx);
  assert.equal(i.intent, "company_developments");
  assert.ok(i.companies.includes("Pfizer"));
  assert.equal(i.timeframeDays, 1);
});

test("filtered trial search extracts status, biomarker, indication", () => {
  const i = parseIntentHeuristic(
    "Find recruiting KRAS G12D trials in pancreatic cancer",
    ctx,
  );
  assert.equal(i.intent, "trial_search");
  assert.ok(i.statuses.includes("recruiting"));
  assert.ok(i.biomarkers.includes("KRAS G12D"));
  assert.ok(i.indications.includes("pancreatic"));
});

test("'Only Phase 2' follow-up narrows to phase 2", () => {
  const i = parseIntentHeuristic("Only Phase 2", ctx);
  assert.ok(i.phases.includes("2"));
});

test("compare intent with two NCT ids", () => {
  const i = parseIntentHeuristic("Compare NCT12345678 and NCT87654321", ctx);
  assert.equal(i.intent, "compare_trials");
  assert.deepEqual(i.nctIds.sort(), ["NCT12345678", "NCT87654321"]);
});

test("overdue follow-ups intent", () => {
  const i = parseIntentHeuristic("Which follow-ups are overdue?", ctx);
  assert.equal(i.intent, "overdue_tasks");
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

test("external research only when explicitly asked", () => {
  assert.equal(parseIntentHeuristic("what changed at Merck", ctx).wantsExternalResearch, false);
  assert.equal(
    parseIntentHeuristic("search the web for the latest Merck KRAS news", ctx).wantsExternalResearch,
    true,
  );
});

test("a company name with a trailing descriptor splits into company + topic", () => {
  const i = parseIntentHeuristic("Search the web for Novartis oncology developments", ctx);
  assert.ok(i.companies.includes("Novartis"));
  assert.ok(!i.companies.some((c) => /oncology/i.test(c)), "'oncology' must not be glued to the company");
  assert.ok(i.topics.includes("oncology"));
  assert.equal(i.wantsExternalResearch, true);
});

test("'latest ... news' triggers external research", () => {
  assert.equal(parseIntentHeuristic("latest Merck KRAS news", ctx).wantsExternalResearch, true);
  assert.equal(parseIntentHeuristic("what changed at Merck", ctx).wantsExternalResearch, false);
});
