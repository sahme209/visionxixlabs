import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer {
  const secret =
    process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.STARTER_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY or STARTER_TOKEN_SECRET (min 32 chars) required"
    );
  }
  return createHash("sha256").update(secret.slice(0, 128)).digest();
}

/**
 * Phase 5: Enterprise credential vault.
 * AES-256-GCM encryption, per-record random IV.
 * Format: iv(12) + authTag(16) + ciphertext — base64url encoded.
 */
export function encryptCredential(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64url");
}

export function decryptCredential(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64url");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) throw new Error("Invalid encrypted payload");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const data = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final("utf8");
}

/**
 * Encrypt a credential that belongs to one specific tenant integration.
 *
 * AES-GCM authenticates the supplied context as additional authenticated
 * data. That means an encrypted Slack credential cannot be copied into a
 * different organization, provider, or connection record and still decrypt.
 * New OAuth integrations must use this API rather than the legacy envelope.
 */
export function encryptScopedCredential(plain: string, context: string): string {
  if (!context.trim()) throw new Error("Credential encryption context is required");
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v2.${Buffer.concat([iv, authTag, enc]).toString("base64url")}`;
}

/** Decrypts only a context-bound v2 credential envelope. */
export function decryptScopedCredential(encrypted: string, context: string): string {
  if (!context.trim()) throw new Error("Credential decryption context is required");
  if (!encrypted.startsWith("v2.")) throw new Error("Invalid scoped credential payload");
  const key = getKey();
  const buf = Buffer.from(encrypted.slice(3), "base64url");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) throw new Error("Invalid scoped credential payload");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const data = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final("utf8");
}
