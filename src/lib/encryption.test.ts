import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "./encryption";

beforeAll(() => {
  // getKey() reads this lazily on each call, so setting it here (not at
  // import time) is enough.
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a plaintext string", () => {
    const encrypted = encryptToken("super-secret-access-token");
    expect(encrypted).not.toContain("super-secret-access-token");
    expect(decryptToken(encrypted)).toBe("super-secret-access-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-input");
    expect(decryptToken(b)).toBe("same-input");
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptToken("value");
    const [iv, tag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${ciphertext.slice(0, -2)}ff`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
