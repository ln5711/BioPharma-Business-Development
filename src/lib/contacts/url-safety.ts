/**
 * URLs in this feature are NEVER fetched server-side — they are shown to the
 * browser as `<a href>` / `<img src>` (Anthropic's hosted web_search tool does
 * the actual fetching on its side). This validator exists as defense in depth
 * against XSS (`javascript:`, `data:` URLs) and against a future feature
 * accidentally fetching one: reject anything that isn't a plain http(s) URL
 * with a public-looking host.
 */
const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1$)|^172\.(1[6-9]|2\d|3[01])\./i;

export function isSafeExternalUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (!u.hostname || PRIVATE_HOST_RE.test(u.hostname)) return false;
  return true;
}

/** Returns the URL unchanged if safe, else null — for storing/rendering. */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  return isSafeExternalUrl(raw) ? raw.trim() : null;
}
