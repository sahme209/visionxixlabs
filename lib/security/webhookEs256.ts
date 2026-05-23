/**
 * ES256 webhook signing — Phase 404.
 *
 * Optional asymmetric alternative to the default HMAC-SHA256 signing
 * (Phase 395). With ES256, the platform holds a private P-256 EC key
 * and signs every outbound delivery; integrators verify with our
 * published public key via the /api/v1/webhooks/jwks endpoint.
 *
 * Why offer ES256 alongside HMAC?
 *   - HMAC requires the platform AND every integrator to hold a
 *     shared secret. If the integrator's secret leaks, an attacker
 *     can FORGE signatures. The blast radius is per-endpoint, but
 *     the trust model is symmetric.
 *   - ES256 only the PLATFORM has the private key. Even if every
 *     integrator's verifier code is stolen, attackers can't sign
 *     anything that passes the public-key check.
 *
 * Compatibility: every existing endpoint defaults to HMAC. ES256 is
 * opt-in per endpoint via `WebhookEndpoint.signingMode = 'es256'`.
 *
 * Pure / deterministic. Uses node:crypto's ECDSA P-256 + SHA-256.
 */

import {
  createSign,
  createVerify,
  createPublicKey,
  createPrivateKey,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

/**
 * Signing-mode closed-union for `WebhookEndpoint.signingMode`.
 * - "hmac"  — legacy + default. Symmetric secret, HMAC-SHA256.
 * - "es256" — Phase 404. Asymmetric P-256 ECDSA, public key via JWKS.
 */
export type WebhookSigningMode = "hmac" | "es256";

export function isWebhookSigningMode(s: string): s is WebhookSigningMode {
  return s === "hmac" || s === "es256";
}

// ============================ key generation ============================

export interface Es256KeyPair {
  /** PEM-encoded private key (PKCS#8). Store secret-of-secrets. */
  privateKeyPem: string;
  /** PEM-encoded public key (SubjectPublicKeyInfo). Safe to publish. */
  publicKeyPem: string;
  /** RFC 7638 JWK thumbprint of the public key. Used as the `kid`. */
  kid: string;
  /** JWKS-format public key suitable for /api/v1/webhooks/jwks. */
  publicJwk: {
    kty: "EC";
    crv: "P-256";
    x: string;
    y: string;
    use: "sig";
    alg: "ES256";
    kid: string;
  };
}

/**
 * Generate a fresh P-256 EC keypair for ES256 webhook signing.
 * Computes the public JWK + RFC 7638 thumbprint kid in one step.
 */
export function generateEs256KeyPair(): Es256KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const jwk = exportPublicJwk(publicKey);
  const kid = jwkThumbprint(jwk);
  return {
    privateKeyPem,
    publicKeyPem,
    kid,
    publicJwk: { ...jwk, kid },
  };
}

/**
 * Convert a public KeyObject to the JWK shape RFC 7517 + 7518 specify
 * for EC keys. Node's `key.export({ format: 'jwk' })` returns this
 * shape directly; we narrow + normalize it here.
 */
function exportPublicJwk(publicKey: KeyObject): {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  use: "sig";
  alg: "ES256";
} {
  const raw = publicKey.export({ format: "jwk" }) as {
    kty?: string; crv?: string; x?: string; y?: string;
  };
  if (raw.kty !== "EC" || raw.crv !== "P-256" || !raw.x || !raw.y) {
    throw new Error("ES256: unexpected JWK shape from node:crypto");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: raw.x,
    y: raw.y,
    use: "sig",
    alg: "ES256",
  };
}

/**
 * RFC 7638 JWK thumbprint: SHA-256 of the canonical (sorted, no
 * whitespace) JSON of the required EC members {crv, kty, x, y}.
 * Returns base64url without padding.
 */
function jwkThumbprint(jwk: { kty: string; crv: string; x: string; y: string }): string {
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  const hash = require("node:crypto").createHash("sha256").update(canonical, "utf8").digest();
  return base64UrlEncode(hash);
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const pad = (4 - (s.length % 4)) % 4;
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

// ============================ signing + verifying ============================

/**
 * Sign a webhook payload with ES256.
 *
 * The canonical signed string is identical to the HMAC path:
 *   `<timestampSec>.<rawBody>`
 *
 * Returns base64url-encoded raw ECDSA signature (NOT the DER-wrapped
 * form Node returns by default — JWS / RFC 7518 mandates raw R||S
 * concatenation for ES256).
 */
export function signWebhookEs256(args: {
  privateKeyPem: string;
  rawBody: string;
  timestampSec: number;
}): string {
  const payload = `${args.timestampSec}.${args.rawBody}`;
  const key = createPrivateKey(args.privateKeyPem);
  const signer = createSign("SHA256");
  signer.update(payload, "utf8");
  const derSignature = signer.sign(key);
  // Convert DER → raw R||S (64 bytes for P-256).
  const raw = derToRawSignature(derSignature);
  return base64UrlEncode(raw);
}

export interface VerifyEs256Input {
  rawBody: string;
  signatureBase64Url: string;
  timestampSec: number;
  publicKeyPem: string;
  /** ±tolerance in seconds (default 300). */
  toleranceSec?: number;
  /** "now" in seconds for tests. */
  nowSec?: number;
}

export type Es256VerifyResult =
  | { valid: true }
  | { valid: false; reason: "bad_signature" | "stale_timestamp" | "future_timestamp" | "malformed_signature" | "key_unparseable" };

export function verifyWebhookEs256(input: VerifyEs256Input): Es256VerifyResult {
  if (typeof input.timestampSec === "number") {
    const now = input.nowSec ?? Math.floor(Date.now() / 1000);
    const tol = Math.max(0, input.toleranceSec ?? 300);
    if (input.timestampSec < now - tol) return { valid: false, reason: "stale_timestamp" };
    if (input.timestampSec > now + tol) return { valid: false, reason: "future_timestamp" };
  }

  let pubKey: KeyObject;
  try {
    pubKey = createPublicKey(input.publicKeyPem);
  } catch {
    return { valid: false, reason: "key_unparseable" };
  }

  let rawSig: Buffer;
  try {
    rawSig = base64UrlDecode(input.signatureBase64Url);
  } catch {
    return { valid: false, reason: "malformed_signature" };
  }
  if (rawSig.length !== 64) {
    return { valid: false, reason: "malformed_signature" };
  }

  const derSig = rawToDerSignature(rawSig);
  const payload = `${input.timestampSec}.${input.rawBody}`;

  const verifier = createVerify("SHA256");
  verifier.update(payload, "utf8");
  const ok = verifier.verify(pubKey, derSig);
  return ok ? { valid: true } : { valid: false, reason: "bad_signature" };
}

// ============================ DER ↔ raw signature helpers ============================
//
// Node's ECDSA signer returns DER-encoded signatures by default:
//   SEQUENCE { INTEGER r, INTEGER s }
// JWS/RFC 7518 expects raw concatenated r||s. We convert in both
// directions so the on-wire format matches RFC 7518 while node:crypto
// stays happy.

function derToRawSignature(der: Buffer): Buffer {
  // DER: 30 LL 02 LR <r> 02 LS <s>
  if (der.length < 8 || der[0] !== 0x30) throw new Error("Invalid DER ECDSA sig");
  let offset = 2;
  if (der[1] & 0x80) {
    // long-form length — skip extra bytes.
    offset += der[1] & 0x7f;
  }
  if (der[offset] !== 0x02) throw new Error("Invalid DER ECDSA sig (r)");
  const rLen = der[offset + 1];
  let r = der.subarray(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  if (der[offset] !== 0x02) throw new Error("Invalid DER ECDSA sig (s)");
  const sLen = der[offset + 1];
  let s = der.subarray(offset + 2, offset + 2 + sLen);

  // Strip any leading zero pads from r/s.
  while (r.length > 0 && r[0] === 0x00) r = r.subarray(1);
  while (s.length > 0 && s[0] === 0x00) s = s.subarray(1);

  // Left-pad each to 32 bytes for P-256.
  const rPadded = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  const sPadded = Buffer.concat([Buffer.alloc(32 - s.length), s]);
  return Buffer.concat([rPadded, sPadded]);
}

function rawToDerSignature(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error("Invalid raw ECDSA sig (expected 64 bytes for P-256)");
  const r = raw.subarray(0, 32);
  const s = raw.subarray(32, 64);
  // Add leading zero when high bit is set so DER INTEGER stays positive.
  const rEncoded = r[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), r]) : r;
  const sEncoded = s[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), s]) : s;
  const seq = Buffer.concat([
    Buffer.from([0x02, rEncoded.length]), rEncoded,
    Buffer.from([0x02, sEncoded.length]), sEncoded,
  ]);
  return Buffer.concat([
    Buffer.from([0x30, seq.length]),
    seq,
  ]);
}
