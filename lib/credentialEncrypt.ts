import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.STARTER_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY or STARTER_TOKEN_SECRET (min 32 chars) required for credential encryption");
  }
  return createHash("sha256").update(secret.slice(0, 128)).digest();
}

/**
 * Encrypt sensitive credential data for storage in fullPayload.
 */
export function encryptCredential(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64url");
}

/**
 * Decrypt credential from fullPayload.
 */
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
