import { describe, it, expect } from "vitest";
import {
  generateEs256KeyPair,
  signWebhookEs256,
  verifyWebhookEs256,
  isWebhookSigningMode,
} from "../webhookEs256";

describe("isWebhookSigningMode", () => {
  it("accepts 'hmac' and 'es256'", () => {
    expect(isWebhookSigningMode("hmac")).toBe(true);
    expect(isWebhookSigningMode("es256")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isWebhookSigningMode("rsa")).toBe(false);
    expect(isWebhookSigningMode("HMAC")).toBe(false);
    expect(isWebhookSigningMode("")).toBe(false);
  });
});

describe("generateEs256KeyPair", () => {
  it("produces a PKCS#8 private + SPKI public PEM pair", () => {
    const kp = generateEs256KeyPair();
    expect(kp.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(kp.publicKeyPem).toContain("BEGIN PUBLIC KEY");
  });

  it("produces a non-empty kid (RFC 7638 thumbprint)", () => {
    const kp = generateEs256KeyPair();
    expect(kp.kid.length).toBeGreaterThan(20);
    // Base64URL alphabet only — no '+' or '/' or padding.
    expect(kp.kid).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a JWK with kty=EC, crv=P-256, alg=ES256", () => {
    const kp = generateEs256KeyPair();
    expect(kp.publicJwk.kty).toBe("EC");
    expect(kp.publicJwk.crv).toBe("P-256");
    expect(kp.publicJwk.alg).toBe("ES256");
    expect(kp.publicJwk.use).toBe("sig");
    expect(kp.publicJwk.kid).toBe(kp.kid);
  });

  it("each call produces a different keypair", () => {
    const a = generateEs256KeyPair();
    const b = generateEs256KeyPair();
    expect(a.privateKeyPem).not.toBe(b.privateKeyPem);
    expect(a.kid).not.toBe(b.kid);
  });
});

describe("signWebhookEs256 + verifyWebhookEs256 — round-trip", () => {
  it("verifies a freshly-minted signature", () => {
    const kp = generateEs256KeyPair();
    const body = '{"type":"release_gate.passed","data":{"passed":true}}';
    const ts = 1_700_000_000;
    const sig = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: body, timestampSec: ts });
    const r = verifyWebhookEs256({
      rawBody: body,
      signatureBase64Url: sig,
      timestampSec: ts,
      publicKeyPem: kp.publicKeyPem,
      nowSec: ts + 5,
    });
    expect(r.valid).toBe(true);
  });

  it("signature is base64url (no '+' / '/' / '=')", () => {
    const kp = generateEs256KeyPair();
    const sig = signWebhookEs256({
      privateKeyPem: kp.privateKeyPem,
      rawBody: "x", timestampSec: 1,
    });
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("signatures vary across timestamps (timestamp is in the signed payload)", () => {
    const kp = generateEs256KeyPair();
    const body = "x";
    const a = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: body, timestampSec: 1 });
    const b = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: body, timestampSec: 2 });
    expect(a).not.toBe(b);
  });
});

describe("verifyWebhookEs256 — failure modes", () => {
  it("rejects a tampered body", () => {
    const kp = generateEs256KeyPair();
    const ts = 1_700_000_000;
    const sig = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: "original", timestampSec: ts });
    const r = verifyWebhookEs256({
      rawBody: "TAMPERED",
      signatureBase64Url: sig,
      timestampSec: ts,
      publicKeyPem: kp.publicKeyPem,
      nowSec: ts,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("bad_signature");
  });

  it("rejects a signature from a DIFFERENT keypair", () => {
    const a = generateEs256KeyPair();
    const b = generateEs256KeyPair();
    const ts = 1_700_000_000;
    const sig = signWebhookEs256({ privateKeyPem: a.privateKeyPem, rawBody: "x", timestampSec: ts });
    const r = verifyWebhookEs256({
      rawBody: "x",
      signatureBase64Url: sig,
      timestampSec: ts,
      publicKeyPem: b.publicKeyPem,
      nowSec: ts,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("bad_signature");
  });

  it("rejects stale timestamps (default tolerance 5 min)", () => {
    const kp = generateEs256KeyPair();
    const ts = 1_700_000_000;
    const sig = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: "x", timestampSec: ts });
    const r = verifyWebhookEs256({
      rawBody: "x",
      signatureBase64Url: sig,
      timestampSec: ts,
      publicKeyPem: kp.publicKeyPem,
      nowSec: ts + 3600, // 1h later
    });
    if (!r.valid) expect(r.reason).toBe("stale_timestamp");
  });

  it("rejects future-dated timestamps", () => {
    const kp = generateEs256KeyPair();
    const ts = 1_700_000_000;
    const sig = signWebhookEs256({ privateKeyPem: kp.privateKeyPem, rawBody: "x", timestampSec: ts });
    const r = verifyWebhookEs256({
      rawBody: "x",
      signatureBase64Url: sig,
      timestampSec: ts,
      publicKeyPem: kp.publicKeyPem,
      nowSec: ts - 3600, // signature is from "the future"
    });
    if (!r.valid) expect(r.reason).toBe("future_timestamp");
  });

  it("rejects malformed signatures (wrong length)", () => {
    const kp = generateEs256KeyPair();
    const r = verifyWebhookEs256({
      rawBody: "x",
      signatureBase64Url: "too-short",
      timestampSec: 1,
      publicKeyPem: kp.publicKeyPem,
      nowSec: 1,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("malformed_signature");
  });

  it("rejects unparseable public keys", () => {
    const r = verifyWebhookEs256({
      rawBody: "x",
      signatureBase64Url: "a".repeat(86),
      timestampSec: 1,
      publicKeyPem: "not a key",
      nowSec: 1,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("key_unparseable");
  });
});
