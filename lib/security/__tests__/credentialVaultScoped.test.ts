import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = "test-only-credential-key-that-is-long-enough-for-aes-gcm";
});

import { decryptScopedCredential, encryptScopedCredential } from "../credentialVault";

describe("scoped credential vault", () => {
  it("decrypts a credential only with its original tenant integration context", () => {
    const encrypted = encryptScopedCredential("token-value", "org-a:slack:connection-1");
    expect(decryptScopedCredential(encrypted, "org-a:slack:connection-1")).toBe("token-value");
    expect(() => decryptScopedCredential(encrypted, "org-b:slack:connection-1")).toThrow();
    expect(() => decryptScopedCredential(encrypted, "org-a:teams:connection-1")).toThrow();
  });

  it("does not accept a legacy envelope as a scoped credential", () => {
    expect(() => decryptScopedCredential("not-a-v2-envelope", "org-a:slack:connection-1")).toThrow();
  });
});
