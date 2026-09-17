import assert from "node:assert/strict";
import { test } from "node:test";
import { asciiFold, emailSafe, splitName } from "@/lib/contacts/name";

test("plain two-word name", () => {
  const s = splitName("Jane Doe");
  assert.equal(s.ambiguous, false);
  assert.equal(s.first, "Jane");
  assert.equal(s.last, "Doe");
});

test("middle name is dropped", () => {
  const s = splitName("Jane Quinn Doe");
  assert.equal(s.ambiguous, false);
  assert.equal(s.first, "Jane");
  assert.equal(s.last, "Doe");
});

test("prefix and suffix are stripped", () => {
  const a = splitName("Dr. John Smith");
  assert.deepEqual([a.first, a.last, a.ambiguous], ["John", "Smith", false]);
  const b = splitName("John Smith Jr.");
  assert.deepEqual([b.first, b.last, b.ambiguous], ["John", "Smith", false]);
  const c = splitName("John Smith, MD");
  assert.deepEqual([c.first, c.last, c.ambiguous], ["John", "Smith", false]);
});

test("hyphenated and compound surnames", () => {
  const a = splitName("Mary-Jane O'Brien-Smith");
  assert.equal(a.ambiguous, false);
  assert.equal(a.first, "Mary-Jane");
  assert.equal(a.last, "O'Brien-Smith");

  const b = splitName("Jean-Luc Picard");
  assert.equal(b.ambiguous, false);
  assert.equal(b.first, "Jean-Luc");
});

test("name particles attach to the surname", () => {
  const s = splitName("Jane van der Berg");
  assert.equal(s.ambiguous, false);
  assert.equal(s.first, "Jane");
  assert.match(s.last, /van der Berg/);
});

test("single-word / mononym names are ambiguous, never guessed", () => {
  const s = splitName("Madonna");
  assert.equal(s.ambiguous, true);
});

test("an initial as the given name is ambiguous", () => {
  const s = splitName("J. Smith");
  assert.equal(s.ambiguous, true);
});

test("empty input is ambiguous, not a crash", () => {
  const s = splitName("   ");
  assert.equal(s.ambiguous, true);
});

test("emailSafe / asciiFold normalise accented characters", () => {
  assert.equal(emailSafe("José"), "jose");
  assert.equal(asciiFold("Müller"), "Muller");
  assert.equal(emailSafe("O'Brien-Smith"), "obrien-smith");
});
