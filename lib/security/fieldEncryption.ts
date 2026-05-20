/**
 * Field-level encryption helper.
 *
 * Used by writers persisting sensitive free-form text (rationale
 * blobs, halt reasons, full stage transcripts). Wraps Node's
 * `crypto` with AES-256-GCM so the ciphertext carries its own auth
 * tag — any tampering surfaces as a decrypt failure.
 *
 * Hard rules:
 *   - 32-byte key derived from FIELD_ENCRYPTION_KEY (32+ bytes raw
 *     or 64-char hex). When unset, encryption is a no-op pass-through
 *     so dev environments keep working (callers can check
 *     `isEncryptionConfigured` before persisting truly sensitive
 *     data in prod).
 *   - 12-byte random IV per encrypt — never reused.
 *   - Output format: `enc:v1:<ivHex>:<tagHex>:<cipherHex>`. The
 *     `enc:` prefix lets readers detect whether a row is encrypted
 *     without a side channel.
 *   - Decrypt is total: an unprefixed payload returns as-is.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null | undefined;

function resolveKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  // Accept 64-char hex (32 bytes). Otherwise, hash whatever the operator
  // provided down to a stable 32-byte key — strictly weaker than a raw
  // 32-byte key, but lets short rotated secrets work without 500ing.
  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = createHash("sha256").update(raw).digest();
  }
  cachedKey = key;
  return cachedKey;
}

/** Clears the cached key — only used by tests so env mutations land. */
export function _resetEncryptionKeyCache(): void {
  cachedKey = undefined;
}

export function isEncryptionConfigured(): boolean {
  return resolveKey() !== null;
}

export function isEncryptedValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt a plaintext string. When no key is configured, returns the
 * plaintext unchanged so dev environments keep functioning. Callers
 * persisting prod data should check `isEncryptionConfigured()`.
 */
export function encryptField(plaintext: string): string {
  const key = resolveKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value previously produced by `encryptField`. Unprefixed
 * input passes through unchanged (lets readers handle mixed rows).
 * Throws when the payload is corrupt or the auth tag doesn't match.
 */
export function decryptField(value: string): string {
  if (!isEncryptedValue(value)) return value;
  const key = resolveKey();
  if (!key) {
    throw new Error("FIELD_ENCRYPTION_KEY is unset but the value is encrypted.");
  }
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Encrypted value has an invalid shape.");
  }
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Encrypted value has wrong-sized IV or auth tag.");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
