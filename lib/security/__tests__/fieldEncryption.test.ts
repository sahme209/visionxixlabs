/**
 * Vitest unit tests for the field-level encryption helper.
 *
 * Locks in: round-trip with a configured key, pass-through when the
 * key is unset, auth-tag detection of tampering, format detection
 * via the `enc:v1:` prefix.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  _resetEncryptionKeyCache,
  decryptField,
  encryptField,
  isEncryptedValue,
  isEncryptionConfigured,
} from "../fieldEncryption";

const ORIGINAL = process.env.FIELD_ENCRYPTION_KEY;
const TEST_KEY = "0".repeat(64); // 32 zero bytes (hex)

describe("field encryption helper", () => {
  beforeEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    _resetEncryptionKeyCache();
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = ORIGINAL;
    _resetEncryptionKeyCache();
  });

  it("passes plaintext through when no key is configured", () => {
    expect(isEncryptionConfigured()).toBe(false);
    const out = encryptField("hello");
    expect(out).toBe("hello");
    expect(isEncryptedValue(out)).toBe(false);
  });

  it("round-trips plaintext with a configured hex key", () => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    _resetEncryptionKeyCache();
    expect(isEncryptionConfigured()).toBe(true);
    const ciphertext = encryptField("operator-eyes-only");
    expect(ciphertext.startsWith("enc:v1:")).toBe(true);
    expect(isEncryptedValue(ciphertext)).toBe(true);
    expect(decryptField(ciphertext)).toBe("operator-eyes-only");
  });

  it("derives a stable key from a short passphrase (sha256-hash fallback)", () => {
    process.env.FIELD_ENCRYPTION_KEY = "shorter-passphrase";
    _resetEncryptionKeyCache();
    expect(isEncryptionConfigured()).toBe(true);
    const ciphertext = encryptField("payload");
    expect(decryptField(ciphertext)).toBe("payload");
  });

  it("produces distinct ciphertexts for the same plaintext (random IV)", () => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    _resetEncryptionKeyCache();
    const a = encryptField("same");
    const b = encryptField("same");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("same");
    expect(decryptField(b)).toBe("same");
  });

  it("detects tampering via the auth tag", () => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    _resetEncryptionKeyCache();
    const ciphertext = encryptField("secret");
    // Flip the last hex digit to its complement in the 0-f range rather
    // than overwriting with a fixed "ff" — the fixed value was flaky
    // (~1/256 chance the original byte already ended in "ff", making the
    // "tamper" a no-op and the decrypt succeed instead of throwing).
    const lastDigit = ciphertext.at(-1)!;
    const flipped = lastDigit === "0" ? "1" : "0";
    const tampered = ciphertext.slice(0, -1) + flipped;
    expect(() => decryptField(tampered)).toThrow();
  });

  it("decryptField passes unprefixed values through unchanged", () => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    _resetEncryptionKeyCache();
    expect(decryptField("not-encrypted")).toBe("not-encrypted");
  });

  it("decryptField throws when key is unset but value is encrypted", () => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    _resetEncryptionKeyCache();
    const ciphertext = encryptField("payload");
    // Now drop the key.
    delete process.env.FIELD_ENCRYPTION_KEY;
    _resetEncryptionKeyCache();
    expect(() => decryptField(ciphertext)).toThrow(/FIELD_ENCRYPTION_KEY/);
  });
});
