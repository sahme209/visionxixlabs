/**
 * API-key crypto kernels — Phase 394.
 *
 * Externally-facing machine-to-machine authentication for the v1
 * surface. Designed so any client — web app, desktop app, CLI, CI
 * runner — can authenticate against `/api/v1/*` with a single
 * Bearer token.
 *
 * Format
 *   vxlk_<env>_<24-char-secret>_<6-char-checksum>
 *     · `vxlk`              — fixed brand prefix
 *     · `<env>`             — "live" | "test"
 *     · `<24-char-secret>`  — base32 (Crockford alphabet, no I/L/O/U) of
 *                              random bytes — the actual entropy
 *     · `<6-char-checksum>` — first 6 chars of base32-encoded
 *                              SHA-256(brand+env+secret) — catches typos
 *
 * Why this shape?
 *   - Prefix lets us index `prefix` in Postgres and skip-look-up keys
 *     by structure without hitting the hash column.
 *   - Checksum gives an offline "this looks malformed" check the
 *     verifier can run *before* doing the constant-time DB lookup,
 *     so brute-force probing is cheaper to detect.
 *   - Single underscore-separated string is easy to copy/paste and
 *     hard to confuse with other secrets.
 *
 * Storage rule
 *   We NEVER store plaintext. The DB only holds:
 *     · prefix      — first 13 chars (`vxlk_live_xxxx`), indexed
 *     · keyHash     — SHA-256(full plaintext), unique
 *   The plaintext is shown to the operator exactly once at mint time.
 *
 * Pure / deterministic. Uses node:crypto.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type ApiKeyEnv = "live" | "test";

const BRAND = "vxlk";
const SECRET_LEN_CHARS = 24;
const CHECKSUM_LEN_CHARS = 6;
const PREFIX_LEN_CHARS = BRAND.length + 1 + 4 + 1 + 4; // "vxlk_live_xxxx" = 14, see prefixOf

// Crockford base32 alphabet — no I, L, O, U so the secret is unambiguous
// when typed by humans. We use it for both the secret + checksum.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface MintedApiKey {
  /** The full plaintext key — show to operator ONCE, never store. */
  plaintext: string;
  /** First N chars — safe to store + display as the key identifier. */
  prefix: string;
  /** SHA-256 hex of the full plaintext — stored in DB for verification. */
  keyHash: string;
  /** "live" | "test". */
  env: ApiKeyEnv;
}

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Compute the prefix of a (well-formed) key. The prefix is what we
 * index in Postgres so a lookup is one B-tree hit.
 *
 * Returns the first PREFIX_LEN_CHARS characters: `vxlk_live_xxxx`.
 */
export function prefixOf(plaintext: string): string {
  return plaintext.slice(0, PREFIX_LEN_CHARS);
}

/**
 * SHA-256 hex of the full plaintext key. This is the column we
 * compare against in the DB — never the plaintext.
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/**
 * Compute the canonical checksum suffix for a (brand, env, secret) triple.
 * First CHECKSUM_LEN_CHARS chars of base32(SHA-256(brand_env_secret)).
 */
function checksumOf(env: ApiKeyEnv, secret: string): string {
  const h = createHash("sha256").update(`${BRAND}_${env}_${secret}`, "utf8").digest();
  return base32Encode(h).slice(0, CHECKSUM_LEN_CHARS);
}

/**
 * Mint a new API key. Returns the plaintext (show once) + the prefix
 * + the hash (the only thing we persist).
 */
export function mintApiKey(env: ApiKeyEnv = "live"): MintedApiKey {
  // 15 random bytes → 24 base32 chars (15 * 8 = 120 bits = 24 * 5).
  const secret = base32Encode(randomBytes(15)).slice(0, SECRET_LEN_CHARS);
  const checksum = checksumOf(env, secret);
  const plaintext = `${BRAND}_${env}_${secret}_${checksum}`;
  return {
    plaintext,
    prefix: prefixOf(plaintext),
    keyHash: hashApiKey(plaintext),
    env,
  };
}

export type ParseFailureKind =
  | "wrong_format"        // not 4 underscore-separated pieces
  | "wrong_brand"         // first piece isn't BRAND
  | "wrong_env"           // env isn't "live" | "test"
  | "wrong_secret_length"
  | "wrong_checksum_length"
  | "bad_checksum";       // checksum doesn't match the secret

export type ParseApiKeyResult =
  | { ok: true; env: ApiKeyEnv; secret: string; checksum: string; prefix: string }
  | { ok: false; reason: ParseFailureKind };

const ALPHABET_RE = new RegExp(`^[${ALPHABET}]+$`);

/**
 * Parse + verify the structural integrity of a key. Does NOT hit the DB
 * — it just confirms the key is a syntactically-valid VisionXIXLabs key
 * with a matching internal checksum. Cheap, so we run it BEFORE the
 * constant-time DB lookup to drop obvious garbage early.
 */
export function parseApiKey(plaintext: string): ParseApiKeyResult {
  const parts = plaintext.split("_");
  if (parts.length !== 4) return { ok: false, reason: "wrong_format" };
  const [brand, env, secret, checksum] = parts;

  if (brand !== BRAND) return { ok: false, reason: "wrong_brand" };
  if (env !== "live" && env !== "test") return { ok: false, reason: "wrong_env" };
  if (secret.length !== SECRET_LEN_CHARS || !ALPHABET_RE.test(secret)) {
    return { ok: false, reason: "wrong_secret_length" };
  }
  if (checksum.length !== CHECKSUM_LEN_CHARS || !ALPHABET_RE.test(checksum)) {
    return { ok: false, reason: "wrong_checksum_length" };
  }

  const expected = checksumOf(env, secret);
  // Checksum is short + low-stakes (just typo detection), but compare
  // length-safely anyway so we don't accidentally short-circuit on the
  // first non-matching char.
  if (expected.length !== checksum.length) {
    return { ok: false, reason: "bad_checksum" };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ checksum.charCodeAt(i);
  }
  if (diff !== 0) return { ok: false, reason: "bad_checksum" };

  return {
    ok: true,
    env,
    secret,
    checksum,
    prefix: prefixOf(plaintext),
  };
}

/**
 * Constant-time hex-string compare. Wraps timingSafeEqual with a
 * length guard so it never throws on mismatched inputs.
 *
 * Use this for the candidate-hash-vs-stored-hash check in the auth
 * lookup. (Even though the prefix index narrows the candidate set,
 * if multiple rows share a prefix we still constant-time over all
 * of them so the timing channel is closed.)
 */
export function verifyKeyHash(candidate: string, stored: string): boolean {
  if (candidate.length !== stored.length) return false;
  try {
    return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(stored, "hex"));
  } catch {
    return false;
  }
}
