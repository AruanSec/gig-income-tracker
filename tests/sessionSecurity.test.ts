import test from "node:test";
import assert from "node:assert/strict";
import { sessionToken, tokenDigest } from "../src/sessionSecurity";
import { generateSalt, hashPassword, verifyPassword } from "../src/passwordSecurity";

test("session digests cannot be presented as bearer tokens and malformed headers do not fall back to cookies", () => {
  const token = "a".repeat(64);
  const digest = tokenDigest(token);
  assert.notEqual(digest, token);
  assert.equal(sessionToken({ headers: { cookie: `other=1; gig_session=${token}` } } as any), token);
  assert.equal(sessionToken({ headers: { authorization: `Bearer ${digest}`, cookie: `gig_session=${token}` } } as any), undefined);
  assert.equal(sessionToken({ headers: { authorization: `Bearer ${token} extra` } } as any), undefined);
});

test("salted scrypt verifies credentials while legacy password hashes require a reset", async () => {
  const salt = generateSalt();
  const hash = await hashPassword("Password-test-2026", salt);
  assert.equal(await verifyPassword("Password-test-2026", salt, hash), true);
  assert.equal(await verifyPassword("Wrong-password-2026", salt, hash), false);
  assert.equal(await verifyPassword("Password-test-2026", salt, "0".repeat(128)), false);
});
