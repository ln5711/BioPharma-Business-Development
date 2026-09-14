import assert from "node:assert/strict";
import { test } from "node:test";
import { countUseCaseKeywordHits, scoreContact } from "@/lib/contacts/rank";

test("a program biomarker director outranks a CEO with no program evidence", () => {
  const director = scoreContact({
    function: "biomarker_development",
    seniority: "director",
    hasDirectProgramEvidence: true,
    useCaseKeywordHits: 2,
    evidenceCount: 3,
    independentSourceCount: 2,
    newestEvidenceDate: "2026-06-01",
  });
  const ceo = scoreContact({
    function: "executive",
    seniority: "c_suite",
    hasDirectProgramEvidence: false,
    useCaseKeywordHits: 0,
    evidenceCount: 1,
    independentSourceCount: 1,
    newestEvidenceDate: "2026-01-01",
  });
  assert.ok(director.total > ceo.total, `director ${director.total} should beat ceo ${ceo.total}`);
  assert.equal(director.label, "direct_program_evidence");
});

test("relevant function without confirmed program ownership is labelled honestly", () => {
  const r = scoreContact({
    function: "clinical_development",
    seniority: "director",
    hasDirectProgramEvidence: false,
    useCaseKeywordHits: 0,
    evidenceCount: 1,
    independentSourceCount: 1,
    newestEvidenceDate: null,
  });
  assert.equal(r.label, "relevant_function_unconfirmed");
});

test("an unrelated function with no evidence is a potential introducer at best", () => {
  const r = scoreContact({
    function: "business_development",
    seniority: "manager",
    hasDirectProgramEvidence: false,
    useCaseKeywordHits: 0,
    evidenceCount: 0,
    independentSourceCount: 0,
    newestEvidenceDate: null,
  });
  assert.equal(r.label, "potential_introducer");
});

test("score is always 0-100 and breakdown sums to the total", () => {
  const r = scoreContact({
    function: "translational_medicine",
    seniority: "head",
    hasDirectProgramEvidence: true,
    useCaseKeywordHits: 10,
    evidenceCount: 5,
    independentSourceCount: 5,
    newestEvidenceDate: "2026-09-01",
  });
  assert.ok(r.total >= 0 && r.total <= 100);
  const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.total);
});

test("evidence quality rewards multiple independent recent sources over one", () => {
  const many = scoreContact({
    function: "other",
    seniority: "unknown",
    hasDirectProgramEvidence: false,
    useCaseKeywordHits: 0,
    evidenceCount: 3,
    independentSourceCount: 3,
    newestEvidenceDate: "2026-08-01",
  });
  const one = scoreContact({
    function: "other",
    seniority: "unknown",
    hasDirectProgramEvidence: false,
    useCaseKeywordHits: 0,
    evidenceCount: 1,
    independentSourceCount: 1,
    newestEvidenceDate: "2018-01-01",
  });
  assert.ok(many.breakdown.evidenceQuality > one.breakdown.evidenceQuality);
});

test("countUseCaseKeywordHits finds ctDNA/MRD/liquid-biopsy language", () => {
  const n = countUseCaseKeywordHits(
    "Leads ctDNA and MRD assay development for companion diagnostic partnerships.",
  );
  assert.ok(n >= 3, `expected multiple hits, got ${n}`);
  assert.equal(countUseCaseKeywordHits("Manages office supplies budget."), 0);
});
