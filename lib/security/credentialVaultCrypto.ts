import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Pure existing v2 AES-GCM kernel. Callers own key resolution and input policy.
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
export function encryptScopedWithKey(key: Uint8Array, plain: string, context: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v2.${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url")}`;
}

export function decryptScopedWithKey(key: Uint8Array, encrypted: string, context: string): string {
  const buf = Buffer.from(encrypted.slice(3), "base64url");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) throw new Error("Invalid scoped credential payload");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, IV_LEN));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN));
  return decipher.update(buf.subarray(IV_LEN + AUTH_TAG_LEN)) + decipher.final("utf8");
}
