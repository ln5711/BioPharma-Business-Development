/**
 * Deterministic name splitting for email-pattern inference. Deliberately
 * conservative: anything it can't confidently split comes back
 * `ambiguous: true` so callers never guess an unsupported variant.
 */

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "phd", "md", "esq"]);
const PREFIXES = new Set(["dr", "prof", "mr", "mrs", "ms", "miss", "rev"]);
/** Lower-case name particles that attach to the FOLLOWING word, not the last. */
const PARTICLES = new Set(["van", "von", "de", "der", "den", "del", "la", "le", "di", "da", "st", "st."]);

export interface SplitName {
  first: string;
  last: string;
  /** true when the split is not confident enough to derive an email from. */
  ambiguous: boolean;
  reason?: string;
}

function stripPunct(w: string): string {
  return w.replace(/^[.,]+|[.,]+$/g, "");
}

/** ASCII-fold for email local-parts: "José" → "jose", "Müller" → "muller". */
export function asciiFold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * Split a full name into an email-safe first/last pair.
 *
 * Handles: middle names/initials (dropped), suffixes ("Jr.", "III"), prefixes
 * ("Dr."), hyphenated surnames ("O'Brien-Smith"), name particles ("van der
 * Berg" → last = "van der Berg" collapsed to "vanderberg" for patterns that
 * use the full surname, first = the given name), and apostrophes ("O'Brien").
 * Refuses (ambiguous=true) for a single-word name, an all-initials name, or a
 * name that is empty after stripping prefixes/suffixes.
 */
export function splitName(fullName: string): SplitName {
  const raw = fullName.trim().replace(/\s+/g, " ");
  if (!raw) return { first: "", last: "", ambiguous: true, reason: "empty name" };

  let words = raw.split(" ").map(stripPunct).filter(Boolean);

  // Drop a leading prefix ("Dr. Jane Doe" → "Jane Doe").
  while (words.length > 1 && PREFIXES.has(words[0].toLowerCase().replace(/\./g, ""))) {
    words = words.slice(1);
  }
  // Drop a trailing suffix ("Jane Doe Jr." / "Jane Doe, MD").
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase().replace(/\./g, ""))) {
    words = words.slice(0, -1);
  }

  if (words.length === 0) return { first: "", last: "", ambiguous: true, reason: "only prefixes/suffixes" };
  if (words.length === 1) {
    // A single token is either a mononym or "FirstLast" glued together — we
    // cannot confidently split it, so no pattern is derived from it.
    return { first: words[0], last: "", ambiguous: true, reason: "single-word name" };
  }

  const first = words[0];
  if (/^[a-z]\.?$/i.test(first.replace(/\./g, ""))) {
    // "J. Smith" — the given name is only an initial; first.last-style
    // patterns can't be derived from an initial alone.
    return { first, last: words.slice(1).join(" "), ambiguous: true, reason: "given name is an initial" };
  }

  // Collapse particles into the surname: "Jane van der Berg" → last "van der Berg".
  const lastWords = words.slice(1);
  let particleStart = lastWords.length - 1;
  for (let i = 0; i < lastWords.length - 1; i++) {
    if (PARTICLES.has(lastWords[i].toLowerCase().replace(/\./g, ""))) {
      particleStart = i;
      break;
    }
  }
  const last = lastWords.slice(particleStart >= lastWords.length - 1 ? lastWords.length - 1 : 0).join(" ");
  // If there's more than one non-particle middle word ("Jane Q Public Doe"),
  // keep the last chunk as the surname and treat the rest as a dropped middle
  // name — normal for email inference.
  const surname = lastWords.length > 1 && particleStart < lastWords.length - 1
    ? lastWords.slice(particleStart).join(" ")
    : lastWords[lastWords.length - 1];

  const finalLast = surname || last || lastWords[lastWords.length - 1];
  if (!finalLast || /^[a-z]\.?$/i.test(finalLast.replace(/\./g, ""))) {
    return { first, last: finalLast, ambiguous: true, reason: "surname is an initial" };
  }

  return { first, last: finalLast, ambiguous: false };
}

/** First/last reduced to lowercase ASCII, hyphens kept (valid in email local-parts). */
export function emailSafe(part: string): string {
  return asciiFold(part.replace(/\s+/g, "")).toLowerCase();
}
