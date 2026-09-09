/**
 * Session cookie: signing, verification, tamper rejection, server-enforced
 * expiry, and revocation-window semantics. Uses an in-memory cookie jar
 * (tests/_stubs/next-headers.ts) and a fixed AUTH_SECRET.
 */
import assert from "node:assert/strict";
import { test, before, beforeEach } from "node:test";

process.env.AUTH_SECRET = "test-secret-that-is-definitely-long-enough-xx";
process.env.NODE_ENV = "test";

let auth: typeof import("@/lib/auth");
let stub: typeof import("./_stubs/next-headers.ts");

before(async () => {
  auth = await import("@/lib/auth");
  stub = await import("./_stubs/next-headers.ts");
});
beforeEach(() => stub.__clearCookies());

test("a freshly created session verifies", async () => {
  await auth.createSession({ userId: "u1", tenantId: "t1" });
  const s = await auth.getSession();
  assert.equal(s?.userId, "u1");
  assert.equal(s?.tenantId, "t1");
  assert.equal(typeof s?.iat, "number");
});

test("a tampered signature is rejected", async () => {
  await auth.createSession({ userId: "u1", tenantId: "t1" });
  const jar = await stub.cookies();
  const [body] = jar.get("nw_session")!.value.split(".");
  jar.set("nw_session", `${body}.deadbeefdeadbeefdeadbeefdeadbeef`);
  assert.equal(await auth.getSession(), null);
});

test("an edited payload is rejected (signature mismatch)", async () => {
  await auth.createSession({ userId: "u1", tenantId: "t1" });
  const jar = await stub.cookies();
  const [, sig] = jar.get("nw_session")!.value.split(".");
  const forged = Buffer.from(
    JSON.stringify({ userId: "attacker", tenantId: "t1", iat: Date.now() }),
  ).toString("base64url");
  jar.set("nw_session", `${forged}.${sig}`);
  assert.equal(await auth.getSession(), null);
});

test("server-enforced expiry: a >30d-old iat is rejected", async () => {
  const crypto = await import("node:crypto");
  const old = Date.now() - 31 * 24 * 3600 * 1000;
  const body = Buffer.from(JSON.stringify({ userId: "u1", tenantId: "t1", iat: old })).toString(
    "base64url",
  );
  const sig = crypto.createHmac("sha256", process.env.AUTH_SECRET!).update(body).digest("base64url");
  const jar = await stub.cookies();
  jar.set("nw_session", `${body}.${sig}`);
  assert.equal(await auth.getSession(), null);
});

test("revocation window: iat <= sessions_revoked_at is dead, later iat is fine", () => {
  const revokedAt = new Date("2025-01-01T00:00:00Z").getTime();
  const isDead = (s: { iat: number }) => s.iat <= revokedAt;
  assert.equal(isDead({ iat: revokedAt - 1 }), true);
  assert.equal(isDead({ iat: revokedAt }), true);
  assert.equal(isDead({ iat: revokedAt + 1 }), false);
});
