import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  normalizeEmail,
  passwordValidationError,
  verifyPassword,
} from "../../lib/auth/credentials";
import { createSessionToken, hashSessionToken } from "../../lib/auth/session-token";

test("normalizeEmail trims and lowercases a valid address", () => {
  assert.equal(normalizeEmail("  Sky.Watcher@Example.COM "), "sky.watcher@example.com");
});

test("normalizeEmail rejects malformed and oversized addresses", () => {
  assert.equal(normalizeEmail("missing-at.example.com"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail(`${"a".repeat(250)}@example.com`), null);
  assert.equal(normalizeEmail(42), null);
});

test("password policy uses length without arbitrary character-class rules", () => {
  assert.equal(passwordValidationError("1234567"), "密码至少需要 8 个字符");
  assert.equal(passwordValidationError("我的星空观察记录"), null);
  assert.equal(passwordValidationError("a".repeat(129)), "密码不能超过 128 个字符");
});

test("Argon2id password hashes verify without storing plaintext", async () => {
  const password = "observatory-2026";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(passwordHash, password), true);
  assert.equal(await verifyPassword(passwordHash, "wrong-password"), false);
});

test("session tokens are random and only their SHA-256 digest is stored", () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.match(hashSessionToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashSessionToken(first), first);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
});
