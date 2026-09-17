import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Minimal first-party auth: scrypt password hashing + an HMAC-signed httpOnly
 * session cookie. No external identity provider is configured; this is the
 * "existing" system to build on. Swap in Auth.js / Clerk / Supabase later by
 * keeping `getSession()` / `createSession()` as the seam.
 */

const COOKIE = "nw_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL_MS = MAX_AGE * 1000;

/** The checked-in development fallback. Must never sign real sessions in prod. */
const DEV_AUTH_SECRET = "newwin-dev-session-secret-change-me";

/**
 * Returns the signing key, or throws in production when it is missing / still the
 * development default / too short. Checked at request time (never at module load)
 * so a misconfigured deploy fails closed on auth without bricking public routes.
 */
function sessionSecret(): string {
  const s = env.AUTH_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (s === DEV_AUTH_SECRET || s.trim().length < 32)
  ) {
    throw new Error(
      "AUTH_SECRET is unset or using the development default in production. " +
        "Set a strong (32+ character) AUTH_SECRET before authentication can work.",
    );
  }
  return s;
}

/** True when a session can be signed/verified in the current environment. */
export function authConfigured(): boolean {
  try {
    sessionSecret();
    return true;
  } catch {
    return false;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const got = scryptSync(password, salt, 64);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface Session {
  userId: string;
  tenantId: string;
  /** Issued-at epoch ms. Present on verified sessions; used for expiry checks. */
  iat?: number;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export async function createSession(session: Session): Promise<void> {
  const body = Buffer.from(JSON.stringify({ ...session, iat: Date.now() })).toString(
    "base64url",
  );
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token || !token.includes(".")) return null;

  const [body, sig] = token.split(".");

  let expected: string;
  try {
    // Throws in a misconfigured production environment → fail closed (no session).
    expected = sign(body);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      typeof parsed?.userId !== "string" ||
      typeof parsed?.tenantId !== "string" ||
      typeof parsed?.iat !== "number"
    ) {
      return null;
    }
    // Server-enforced expiry: reject anything older than the cookie's max age,
    // regardless of what the browser chose to keep sending.
    if (!Number.isFinite(parsed.iat) || Date.now() - parsed.iat > SESSION_TTL_MS) {
      return null;
    }
    return { userId: parsed.userId, tenantId: parsed.tenantId, iat: parsed.iat };
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Invalidate every session ever issued for a user (this device and all others).
 * Sets `users.sessions_revoked_at = now`; `getOptionalAuth()` rejects any token
 * whose `iat` is at or before that instant. Call on password change and on an
 * explicit "sign out everywhere".
 */
export async function revokeSessions(userId: string): Promise<void> {
  const { getDb } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  await db.update(users).set({ sessionsRevokedAt: new Date() }).where(eq(users.id, userId));
}
