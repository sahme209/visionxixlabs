import { encryptScopedWithKey, decryptScopedWithKey } from "./credentialVaultCrypto";

// Private API allocation bounds only; legacy wrappers remain unbounded/unchanged.
const MAX_PLAIN_BYTES = 1024 * 1024;
const MAX_CONTEXT_BYTES = 4096;
const MAX_ENCRYPTED_CHARS = 3 + Math.ceil((MAX_PLAIN_BYTES + 12 + 16) * 4 / 3);

function validateContext(context: string, operation: "encryption" | "decryption") {
  if (typeof context !== "string" || !context.trim()) throw new Error(`Credential ${operation} context is required`);
  if (context.length > MAX_CONTEXT_BYTES || Buffer.byteLength(context, "utf8") > MAX_CONTEXT_BYTES) throw new Error("Credential context exceeds private vault limit");
}

/** Explicit resource instance, not an authorization or custody qualification. */
export function createPrivateCredentialVault(suppliedKey: Uint8Array) {
  if (!(suppliedKey instanceof Uint8Array) || suppliedKey.byteLength !== 32) throw new Error("Private credential vault requires a 32-byte key");
  const key = Buffer.from(suppliedKey);
  return Object.freeze({
    encryptScopedCredential(plain: string, context: string): string {
      validateContext(context, "encryption");
      if (typeof plain !== "string" || plain.length > MAX_PLAIN_BYTES || Buffer.byteLength(plain, "utf8") > MAX_PLAIN_BYTES) throw new Error("Credential plaintext exceeds private vault limit");
      return encryptScopedWithKey(key, plain, context);
    },
    decryptScopedCredential(encrypted: string, context: string): string {
      validateContext(context, "decryption");
      if (typeof encrypted !== "string" || !encrypted.startsWith("v2.") || encrypted.length > MAX_ENCRYPTED_CHARS) throw new Error("Invalid scoped credential payload");
      return decryptScopedWithKey(key, encrypted, context);
    },
  });
}
