import assert from "node:assert/strict";
import { test } from "node:test";
import { priorityMatcher, matchesPriority } from "@/lib/user-prefs";
import type { Priority } from "@/db/schema";

function p(text: string, extra: Partial<Priority> = {}): Priority {
  return { id: "x", text, paused: false, order: 0, ...extra };
}
const match = (priorityText: string, haystack: string) =>
  matchesPriority(haystack.toLowerCase(), priorityMatcher(p(priorityText)));

test("short oncology terms are NOT filtered out by length", () => {
  assert.ok(match("Track RAS-altered tumours", "New KRAS G12C inhibitor enters phase I"));
  assert.ok(match("MET exon 14 skipping", "capmatinib data in MET exon 14 NSCLC"));
  assert.ok(match("RET fusion cancers", "selpercatinib label expansion for RET fusion"));
  assert.ok(match("ALK-positive NSCLC", "resistance to ALK inhibitors"));
  assert.ok(match("CRC screening partners", "phase III in metastatic CRC"));
});

test("short terms respect word boundaries (no substring false positives)", () => {
  assert.equal(match("RAS pathway", "the study was embarrassing for the sponsor"), false);
  assert.equal(match("MET inhibitor", "the trial met its primary endpoint"), true); // 'met' as a word still matches — acceptable
  assert.equal(match("ALK", "a walk in the park"), false);
});

test("synonyms expand short forms", () => {
  assert.ok(match("CRC", "new data in colorectal cancer"));
  assert.ok(match("NSCLC opportunities", "non-small cell lung cancer sponsor financing"));
  assert.ok(match("ctDNA monitoring", "liquid biopsy MRD assay launch"));
});

test("multi-word priorities match on their significant words", () => {
  assert.ok(match("companion diagnostic partnerships", "seeking a companion diagnostic partner"));
  // Individual significant words match too (recall over precision) …
  assert.ok(match("companion diagnostic partnerships", "new diagnostic assay approved"));
  // … but noise words never do.
  assert.equal(match("prepare for the meeting", "quarterly revenue update"), false);
});

test("noise words alone do not match everything", () => {
  const m = priorityMatcher(p("track our new companies"));
  assert.deepEqual(m.tokens, []);
  assert.deepEqual(m.phrases, []);
  assert.equal(matchesPriority("any random signal headline", m), false);
});
