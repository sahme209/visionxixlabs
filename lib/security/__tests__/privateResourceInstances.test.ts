import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, createDecipheriv } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as privateVault from "../privateCredentialVault";
import * as privateDatabase from "../privateAuthorityDatabase";
import { encryptCredential, encryptScopedCredential, decryptScopedCredential } from "../credentialVault";

afterEach(() => vi.unstubAllEnvs());
const key = () => Buffer.alloc(32, 7);

describe("private vault actual AES-GCM", () => {
  it("round trips empty, Unicode and multi-block plaintext with exact context bytes", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    vi.stubEnv("STARTER_TOKEN_SECRET", "");
    const vault = privateVault.createPrivateCredentialVault(key());
    for (const plain of ["", "🔐 confidential é", "x".repeat(1024)]) {
      const encrypted = vault.encryptScopedCredential(plain, " org:app:é🔐 ");
      expect(encrypted.startsWith("v2.")).toBe(true);
      // Independently consume the wire format with actual Node AES-GCM.
      const bytes = Buffer.from(encrypted.slice(3), "base64url");
      const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      cipher.setAAD(Buffer.from(" org:app:é🔐 ", "utf8"));
      expect(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8")).toBe(plain);
      expect(vault.decryptScopedCredential(encrypted, " org:app:é🔐 ")).toBe(plain);
      expect(() => vault.decryptScopedCredential(encrypted, "org:app")).toThrow();
    }
  });
  it("copies its supplied key and separates other instance keys", () => {
    const supplied = Uint8Array.from(key());
    const vault = privateVault.createPrivateCredentialVault(supplied);
    const encrypted = vault.encryptScopedCredential("secret", "ctx");
    supplied.fill(8);
    expect(vault.decryptScopedCredential(encrypted, "ctx")).toBe("secret");
    expect(() => privateVault.createPrivateCredentialVault(supplied).decryptScopedCredential(encrypted, "ctx")).toThrow();
  });
  it("interoperates with existing v2 using the unchanged legacy derived key", () => {
    const secret = "s".repeat(140);
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", secret);
    const vault = privateVault.createPrivateCredentialVault(createHash("sha256").update(secret.slice(0, 128)).digest());
    expect(vault.decryptScopedCredential(encryptScopedCredential("legacy 🔐", "ctx"), "ctx")).toBe("legacy 🔐");
    expect(decryptScopedCredential(vault.encryptScopedCredential("private 🔐", "ctx"), "ctx")).toBe("private 🔐");
    expect(() => vault.decryptScopedCredential(encryptCredential("old"), "ctx")).toThrow();
  });
  it("refuses invalid keys without environment fallback", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "s".repeat(40));
    for (const invalid of [undefined, "s".repeat(32), Buffer.alloc(31), Buffer.alloc(33)]) {
      expect(() => privateVault.createPrivateCredentialVault(invalid as Uint8Array)).toThrow();
    }
  });
  it("refuses empty contexts, corrupted envelopes and oversized private input", () => {
    const vault = privateVault.createPrivateCredentialVault(key());
    expect(() => vault.encryptScopedCredential("s", " ")).toThrow();
    expect(() => vault.decryptScopedCredential("v2.", " ")).toThrow();
    expect(() => vault.decryptScopedCredential("v2.AA", "ctx")).toThrow();
    const encrypted = vault.encryptScopedCredential("secret", "ctx");
    const bytes = Buffer.from(encrypted.slice(3), "base64url"); bytes[15] ^= 1;
    expect(() => vault.decryptScopedCredential("v2." + bytes.toString("base64url"), "ctx")).toThrow();
    expect(() => vault.encryptScopedCredential("x".repeat(1048577), "ctx")).toThrow();
    expect(() => vault.encryptScopedCredential("s", "x".repeat(4097))).toThrow();
    expect(() => vault.encryptScopedCredential("s", "é".repeat(2049))).toThrow();
    expect(() => vault.encryptScopedCredential("🔐".repeat(262145), "ctx")).toThrow();
    expect(() => vault.decryptScopedCredential("v2." + "A".repeat(1398143), "ctx")).toThrow();
    const boundary = "x".repeat(1048576);
    expect(vault.decryptScopedCredential(vault.encryptScopedCredential(boundary, "x".repeat(4096)), "x".repeat(4096))).toBe(boundary);
  });
});

describe("private actual Prisma client", () => {
  it("supplies explicit datasource to distinct lazy clients with owned disconnect", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://unused.invalid/environment");
    const url = "postgresql://synthetic:synthetic@127.0.0.1:1/private_test";
    const first = privateDatabase.createPrivateAuthorityDatabase(url);
    const second = privateDatabase.createPrivateAuthorityDatabase(url);
    try {
      expect(first).toBeInstanceOf(PrismaClient);
      expect(first).not.toBe(second);
      // Inspect real constructor configuration without connecting or executing SQL.
      const internal = first as unknown as { _engineConfig: { overrideDatasources: unknown }; _engine: { libraryStarted?: boolean } };
      expect(internal._engineConfig.overrideDatasources).toEqual({ db: { url } });
      expect(internal._engine.libraryStarted).not.toBe(true);
    } finally { await first.$disconnect(); await second.$disconnect(); }
  });
  it("refuses missing, non-PostgreSQL, oversized and malformed datasource values", () => {
    for (const input of [undefined, "", " postgres://localhost/db", "file:test", "https://localhost/db", "postgresql://", "postgresql://localhost/", "postgresql://localhost/" + "x".repeat(8192)]) {
      expect(() => privateDatabase.createPrivateAuthorityDatabase(input as string)).toThrow();
    }
  });
});
