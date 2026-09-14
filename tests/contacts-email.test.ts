import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeEmployeeExamples, isPlausibleEmail, resolveContactEmail } from "@/lib/contacts/email";

const NOW = "2026-09-14T00:00:00.000Z";
const src = (url: string) => ({ kind: "employee_example", url });

test("a directly published email is provenance=publicly_sourced, never inferred", () => {
  const c = resolveContactEmail({
    personName: "Jane Doe",
    publishedEmail: { address: "Jane.Doe@Example.com", source: { kind: "company_page", url: "https://example.com/team" } },
    employerDomain: "example.com",
    employeeExamples: [],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "publicly_sourced");
  assert.equal(c.address, "jane.doe@example.com");
  assert.equal(c.pattern, null);
  assert.equal(c.confidence, "high");
});

test("two distinct employees support first.last → a candidate is generated", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "https://example.com/b" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "inferred_pattern");
  assert.equal(c.pattern, "first.last");
  assert.equal(c.address, "john.smith@example.com");
  assert.equal(c.confidence, "medium");
  assert.equal(c.supportingExamples.length, 2);
});

test("three or more distinct supporters raise confidence to high", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "https://example.com/b" },
      { name: "Grace Hopper", email: "grace.hopper@example.com", sourceUrl: "https://example.com/c" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.confidence, "high");
});

test("one example is not enough evidence — no candidate is generated", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [{ name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" }],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found");
  assert.equal(c.address, null);
  assert.match(c.note ?? "", /1 supporting example|at least 2/i);
});

test("a duplicate MIRROR of the same address does not count as a second supporter", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://mirror1.example.com/a" },
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://mirror2.example.com/a" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found", "same address repeated across pages is still ONE distinct employee");
});

test("conflicting patterns with equal support leave the address unresolved", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [
      // first.last pattern (2 supporters)
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "https://example.com/b" },
      // firstlast pattern (2 supporters) — equally supported, conflicting
      { name: "Grace Hopper", email: "gracehopper@example.com", sourceUrl: "https://example.com/c" },
      { name: "Ada Lovelace", email: "adalovelace@example.com", sourceUrl: "https://example.com/d" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found");
  assert.match(c.note ?? "", /conflicting/i);
});

test("off-domain examples are not evidence for this company", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@other.com", sourceUrl: "https://other.com/a" },
      { name: "Alan Turing", email: "alan.turing@other.com", sourceUrl: "https://other.com/b" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found");
});

test("no employer domain known → not_found, no pattern invented", () => {
  const c = resolveContactEmail({
    personName: "John Smith",
    employerDomain: null,
    employeeExamples: [],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found");
  assert.match(c.note ?? "", /domain/i);
});

test("an unsplittable target name is not_found even with strong pattern evidence", () => {
  const c = resolveContactEmail({
    personName: "Madonna",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "https://example.com/b" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "not_found");
  assert.match(c.note ?? "", /split/i);
});

test("hyphenated target surname resolves under a confirmed pattern", () => {
  const c = resolveContactEmail({
    personName: "Mary-Jane O'Brien-Smith",
    employerDomain: "example.com",
    employeeExamples: [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: "https://example.com/a" },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "https://example.com/b" },
    ],
    resolvedAt: NOW,
  });
  assert.equal(c.provenance, "inferred_pattern");
  assert.equal(c.address, "mary-jane.obrien-smith@example.com");
});

test("analyzeEmployeeExamples reports per-pattern support counts", () => {
  const a = analyzeEmployeeExamples(
    [
      { name: "Jane Doe", email: "jane.doe@example.com", sourceUrl: src("").url },
      { name: "Alan Turing", email: "alan.turing@example.com", sourceUrl: "" },
    ],
    "example.com",
  );
  assert.equal(a.resolvedPattern, "first.last");
  assert.equal(a.patternSupport["first.last"], 2);
});

test("isPlausibleEmail rejects garbage", () => {
  assert.equal(isPlausibleEmail("jane.doe@example.com"), true);
  assert.equal(isPlausibleEmail("not-an-email"), false);
  assert.equal(isPlausibleEmail("jane@"), false);
});
