/**
 * Deterministic query-parser tests — the router that decides search vs. the
 * Home recommendation feed. Covers the acceptance-test phrasings.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuery } from "@/lib/search/parse-query";

test("bare biomarker → trials intent, biomarker extracted", () => {
  const p = parseQuery("KRAS");
  assert.ok(p.biomarkers.includes("KRAS"));
  assert.equal(p.intents.trials, true);
  assert.equal(p.intents.priorities, false);
});

test("'KRAS trials today' → trials + freshness=today, NOT priorities", () => {
  const p = parseQuery("KRAS trials today");
  assert.ok(p.biomarkers.includes("KRAS"));
  assert.equal(p.intents.trials, true);
  assert.equal(p.intents.priorities, false);
  assert.equal(p.freshness.days, 1);
  assert.equal(p.freshness.label, "today");
});

test("'KRAS G12D pancreatic trials recruiting' → mutation, indication, status", () => {
  const p = parseQuery("KRAS G12D pancreatic trials recruiting");
  assert.ok(p.biomarkers.includes("KRAS G12D"));
  assert.ok(!p.biomarkers.includes("KRAS"), "G12D span should not also yield a bare KRAS");
  assert.ok(p.indications.includes("pancreatic cancer"));
  assert.ok(p.statuses.includes("recruiting"));
  assert.equal(p.intents.trials, true);
});

test("'RMC-6236' → asset, trials intent", () => {
  const p = parseQuery("RMC-6236");
  assert.ok(p.assets.includes("RMC-6236"));
  assert.equal(p.intents.trials, true);
});

test("'Amgen KRAS trials' → company + biomarker + trials", () => {
  const p = parseQuery("Amgen KRAS trials");
  assert.ok(p.companies.map((c) => c.toLowerCase()).includes("amgen"));
  assert.ok(p.biomarkers.includes("KRAS"));
  assert.equal(p.intents.trials, true);
});

test("'phase 3 KRAS trials' → phase_3 filter", () => {
  const p = parseQuery("phase 3 KRAS trials");
  assert.ok(p.phases.includes("phase_3"));
  assert.ok(p.biomarkers.includes("KRAS"));
});

test("'recruiting pancreatic cancer trials' → status + indication, no phantom biomarker", () => {
  const p = parseQuery("recruiting pancreatic cancer trials");
  assert.ok(p.statuses.includes("recruiting"));
  assert.ok(p.indications.includes("pancreatic cancer"));
  assert.equal(p.biomarkers.length, 0);
  assert.equal(p.intents.trials, true);
});

test("'HER2 breast cancer trials' and 'EGFR trials'", () => {
  const a = parseQuery("HER2 breast cancer trials");
  assert.ok(a.biomarkers.includes("HER2"));
  assert.ok(a.indications.includes("breast cancer"));
  const b = parseQuery("EGFR trials");
  assert.ok(b.biomarkers.includes("EGFR"));
  assert.equal(b.intents.trials, true);
});

test("an NCT id → nctIds + trials intent", () => {
  const p = parseQuery("NCT04185883");
  assert.deepEqual(p.nctIds, ["NCT04185883"]);
  assert.equal(p.intents.trials, true);
});

test("'what changed in KRAS this week' → signals intent + 7-day freshness", () => {
  const p = parseQuery("what changed in KRAS this week");
  assert.ok(p.biomarkers.includes("KRAS"));
  assert.equal(p.intents.signals, true);
  assert.equal(p.freshness.days, 7);
  assert.equal(p.intents.priorities, false);
});

test("freshness KIND: new/updated/latest are not equivalent", () => {
  assert.equal(parseQuery("new KRAS trials today").freshness.kind, "posted");
  assert.equal(parseQuery("KRAS trials today").freshness.kind, "any");
  assert.equal(parseQuery("KRAS trials updated today").freshness.kind, "updated");
  assert.equal(parseQuery("latest KRAS trials").freshness.kind, "any");
  assert.equal(parseQuery("KRAS trials updated this week").freshness.kind, "updated");
  assert.equal(parseQuery("new oncology trials this week").freshness.kind, "posted");
  // "updated" wins when both cue words appear
  assert.equal(parseQuery("new KRAS trials updated today").freshness.kind, "updated");
  // day windows still parse alongside the kind
  assert.equal(parseQuery("new KRAS trials today").freshness.days, 1);
  assert.equal(parseQuery("KRAS trials updated this week").freshness.days, 7);
});

test("'what should I focus on today?' → priorities ONLY (no entity)", () => {
  const p = parseQuery("what should I focus on today?");
  assert.equal(p.intents.priorities, true);
  assert.equal(p.intents.trials, false);
  assert.equal(p.intents.signals, false);
  assert.equal(p.biomarkers.length, 0);
});

test("'what should I focus on for KRAS?' is a search, not the feed", () => {
  const p = parseQuery("what should I focus on for KRAS?");
  assert.equal(p.intents.priorities, false, "an entity present disables priorities mode");
  assert.ok(p.biomarkers.includes("KRAS"));
});

test("'Roche bioinformatics leaders' → people intent + roles", () => {
  const p = parseQuery("Roche bioinformatics leaders");
  assert.equal(p.intents.people, true);
  assert.ok(p.personRoles.some((r) => /bioinformatics|leaders?/.test(r)));
  assert.ok(p.companies.map((c) => c.toLowerCase()).includes("roche"));
});
