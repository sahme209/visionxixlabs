/**
 * Web-to-desktop handoff signer.
 *
 * Produces an HMAC-SHA256 signature over the canonical JSON of a
 * `HandoffPayload`. The signing key is sourced from
 * `DESKTOP_HANDOFF_SIGNING_KEY` (preferred) or `NEXTAUTH_SECRET` (fallback,
 * so a deployment doesn't fail closed before the dedicated key is set).
 *
 * Hard rules:
 *  - Refuses to sign without `organizationId`, `userId`, and
 *    `executionPlanId`.
 *  - Refuses TTL > 1 hour. Desktop handoffs are short-lived by design.
 *  - Refuses signing when the payload contains anything that *looks* like
 *    a credential (private key block, AWS-style token, JWT, …).
 *  - Server-only: this module imports `node:crypto`. Never import from a
 *    client component.
 */

import { createHmac, randomBytes } from "node:crypto";
import {
  HANDOFF_CONTRACT_VERSION,
  canonicaliseHandoff,
} from "./handoffContract";
import type { HandoffPayload, SignedHandoff } from "./handoffContract";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/** Current active signing key id. Bump alongside the env key to roll. */
export const ACTIVE_SIGNING_KEY_ID = "axiom.desktop.handoff.v1";

const MAX_TTL_MS = 60 * 60 * 1000; // 1 hour
const SECRET_LIKE = [
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED |PRIVATE )?PRIVATE KEY-----/,
  /\b(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\bghp_[A-Za-z0-9]{36,}\b/,
];

function resolveSigningKey(): Buffer {
  const explicit = process.env.DESKTOP_HANDOFF_SIGNING_KEY?.trim();
  const fallback = process.env.NEXTAUTH_SECRET?.trim();
  const value = explicit || fallback;
  if (!value || value.length < 32) {
    throw AxiomErrors.internal(
      "desktop.signer.no_key",
      "Desktop handoff signing requires DESKTOP_HANDOFF_SIGNING_KEY (≥ 32 chars).",
    );
  }
  return Buffer.from(value, "utf8");
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

export interface SignHandoffOptions {
  /** Optional override key for tests. */
  signingKey?: Buffer;
  /** Optional key id for tests. */
  keyId?: string;
}

export function signHandoff(payload: HandoffPayload, opts: SignHandoffOptions = {}): SignedHandoff {
  assertPayloadShape(payload);
  assertTtl(payload);
  assertNoSecretsInPayload(payload);

  const key = opts.signingKey ?? resolveSigningKey();
  const canonical = canonicaliseHandoff(payload);
  const signature = createHmac("sha256", key).update(canonical).digest("hex");
  return {
    payload,
    signature,
    algorithm: "HS256",
    keyId: opts.keyId ?? ACTIVE_SIGNING_KEY_ID,
  };
}

/** Generate a fresh 128-bit nonce string. Used by the issue route. */
export function newHandoffNonce(): string {
  return randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------------
// Validation helpers used by signer (mirrored in validator)
// ---------------------------------------------------------------------------

function assertPayloadShape(p: HandoffPayload): void {
  if (p.version !== HANDOFF_CONTRACT_VERSION) {
    throw AxiomErrors.validation("desktop.signer.bad_version", `Unsupported handoff version: ${p.version}`);
  }
  if (!p.organizationId || !p.userId || !p.executionPlanId) {
    throw AxiomErrors.validation("desktop.signer.missing_scope", "Handoff requires organizationId + userId + executionPlanId.");
  }
  if (!p.nonce || p.nonce.length < 16) {
    throw AxiomErrors.validation("desktop.signer.weak_nonce", "Handoff nonce too short.");
  }
  if (!p.policyDecisionId) {
    throw AxiomErrors.validation("desktop.signer.no_policy", "Handoff must reference a policy decision.");
  }
  if (p.allowedOperation === "execute_local" && !p.approvalId) {
    throw AxiomErrors.validation("desktop.signer.execute_needs_approval", "execute_local handoff requires an approval id.");
  }
}

function assertTtl(p: HandoffPayload): void {
  const issued = Date.parse(p.issuedAt);
  const expires = Date.parse(p.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires)) {
    throw AxiomErrors.validation("desktop.signer.bad_dates", "Handoff issuedAt/expiresAt must be valid ISO timestamps.");
  }
  if (expires <= issued) {
    throw AxiomErrors.validation("desktop.signer.bad_ttl", "Handoff expiresAt must be after issuedAt.");
  }
  if (expires - issued > MAX_TTL_MS) {
    throw AxiomErrors.validation("desktop.signer.ttl_too_long", `Handoff TTL exceeds the max ${Math.round(MAX_TTL_MS / 60_000)} minutes.`);
  }
}

/**
 * Refuse to sign when the payload's structured fields contain anything that
 * looks like a credential. Defence-in-depth — the upstream redactor should
 * have caught it, but the signer is the last line.
 */
function assertNoSecretsInPayload(p: HandoffPayload): void {
  const serialised = JSON.stringify(p);
  for (const pattern of SECRET_LIKE) {
    if (pattern.test(serialised)) {
      throw AxiomErrors.validation(
        "desktop.signer.secret_in_payload",
        "Handoff payload looks to contain a credential. Secrets must never travel inside a handoff.",
      );
    }
  }
}
