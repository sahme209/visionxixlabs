/**
 * Web-to-desktop handoff validator.
 *
 * The desktop runtime calls `validateHandoff()` before doing *anything*
 * with a received `SignedHandoff`. It returns a typed verdict (ok or one
 * of a small set of stable rejection reasons) — never throws on bad input.
 *
 * Hard rules enforced here (mirror the signer):
 *  - Wire version matches `HANDOFF_CONTRACT_VERSION`
 *  - HMAC signature matches a known key id
 *  - `expiresAt` is in the future
 *  - `nonce` has not been seen before (replay)
 *  - `organizationId` matches the paired desktop's tenant
 *  - `userId` matches the paired desktop's user
 *  - `allowedOperation` is one the desktop wants to perform
 *  - Required capabilities are a subset of what the desktop supports
 *  - Plan checksum matches the local copy
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  HANDOFF_CONTRACT_VERSION,
  canonicaliseHandoff,
} from "./handoffContract";
import type {
  DesktopCapabilityRequirement,
  HandoffOperation,
  SignedHandoff,
} from "./handoffContract";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export type HandoffRejectionReason =
  | "version_mismatch"
  | "signature_invalid"
  | "unknown_key"
  | "expired"
  | "replayed"
  | "tenant_mismatch"
  | "user_mismatch"
  | "operation_not_allowed"
  | "missing_capability"
  | "checksum_mismatch"
  | "malformed";

export type HandoffVerdict =
  | { ok: true; payload: SignedHandoff["payload"] }
  | { ok: false; reason: HandoffRejectionReason; detail?: string };

// ---------------------------------------------------------------------------
// Validator inputs
// ---------------------------------------------------------------------------

export interface NonceStore {
  /** Returns true when the nonce has been observed before. The implementation
   *  is responsible for atomic check-and-mark so two parallel handoffs can't
   *  both claim "first". */
  hasSeen(nonce: string): Promise<boolean>;
  /** Mark a nonce seen. Implementations should set a TTL ≥ the handoff TTL. */
  remember(nonce: string, ttlMs: number): Promise<void>;
}

export interface ValidateHandoffInput {
  /** The signed envelope received over the wire. */
  signed: SignedHandoff;
  /** The signing keys this desktop trusts, keyed by `keyId`. */
  trustedKeys: Record<string, Buffer | string>;
  /** Tenant + user identity the desktop is paired to. */
  pairedOrganizationId: OrganizationId;
  pairedUserId: UserId;
  /** Operation the desktop wants to perform. Validator rejects if the
   *  signed payload's `allowedOperation` doesn't match. */
  intendedOperation: HandoffOperation;
  /** Capabilities the desktop reports. Validator rejects when a required
   *  capability is not supported locally. */
  desktopCapabilities: DesktopCapabilityRequirement[];
  /** Local checksum of the plan bundle the desktop downloaded. */
  localPlanChecksum: string;
  /** Replay-protection store. */
  nonceStore: NonceStore;
  /** Optional override for "now" in tests. */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export async function validateHandoff(input: ValidateHandoffInput): Promise<HandoffVerdict> {
  const { signed, trustedKeys, pairedOrganizationId, pairedUserId, intendedOperation, desktopCapabilities, localPlanChecksum, nonceStore } = input;
  const now = input.now ?? new Date();

  // 1. Shape + version
  if (!signed || typeof signed !== "object" || !signed.payload || !signed.signature) {
    return { ok: false, reason: "malformed", detail: "Envelope missing payload or signature." };
  }
  if (signed.payload.version !== HANDOFF_CONTRACT_VERSION) {
    return { ok: false, reason: "version_mismatch", detail: `Got version ${signed.payload.version}, expected ${HANDOFF_CONTRACT_VERSION}.` };
  }
  if (signed.algorithm !== "HS256") {
    return { ok: false, reason: "signature_invalid", detail: `Unknown algorithm: ${signed.algorithm}` };
  }

  // 2. Signature
  const key = trustedKeys[signed.keyId];
  if (!key) {
    return { ok: false, reason: "unknown_key", detail: `Key id ${signed.keyId} not in trustedKeys.` };
  }
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  const canonical = canonicaliseHandoff(signed.payload);
  const expected = createHmac("sha256", keyBuf).update(canonical).digest();
  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(signed.signature, "hex");
  } catch {
    return { ok: false, reason: "signature_invalid", detail: "Signature is not valid hex." };
  }
  if (signatureBuf.length !== expected.length) {
    return { ok: false, reason: "signature_invalid", detail: "Signature length mismatch." };
  }
  if (!timingSafeEqual(signatureBuf, expected)) {
    return { ok: false, reason: "signature_invalid" };
  }

  // 3. Expiry
  const expiresMs = Date.parse(signed.payload.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) {
    return { ok: false, reason: "expired", detail: `Expired at ${signed.payload.expiresAt}.` };
  }

  // 4. Replay protection
  const seen = await nonceStore.hasSeen(signed.payload.nonce);
  if (seen) {
    return { ok: false, reason: "replayed" };
  }

  // 5. Tenant / user identity
  if (signed.payload.organizationId !== pairedOrganizationId) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  if (signed.payload.userId !== pairedUserId) {
    return { ok: false, reason: "user_mismatch" };
  }

  // 6. Operation gate
  if (signed.payload.allowedOperation !== intendedOperation) {
    return {
      ok: false,
      reason: "operation_not_allowed",
      detail: `Handoff allows "${signed.payload.allowedOperation}" but desktop tried "${intendedOperation}".`,
    };
  }

  // 7. Capability gate
  for (const required of signed.payload.requiredCapabilities) {
    if (!desktopCapabilities.includes(required)) {
      return {
        ok: false,
        reason: "missing_capability",
        detail: `Desktop is missing required capability "${required}".`,
      };
    }
  }

  // 8. Plan checksum
  if (signed.payload.planChecksum !== localPlanChecksum) {
    return { ok: false, reason: "checksum_mismatch" };
  }

  // 9. Mark nonce seen so a second valid call replays-correctly into failure
  const ttlMs = Math.max(0, expiresMs - now.getTime());
  await nonceStore.remember(signed.payload.nonce, ttlMs);

  return { ok: true, payload: signed.payload };
}

// ---------------------------------------------------------------------------
// Reason display — for the desktop UI
// ---------------------------------------------------------------------------

export const REJECTION_REASON_LABEL: Record<HandoffRejectionReason, string> = {
  version_mismatch:       "Handoff wire version doesn't match.",
  signature_invalid:      "Handoff signature is invalid.",
  unknown_key:            "Handoff signed with a key the desktop doesn't trust.",
  expired:                "Handoff has expired.",
  replayed:               "Handoff has already been used.",
  tenant_mismatch:        "Handoff is for a different tenant than this desktop.",
  user_mismatch:          "Handoff is for a different user than this desktop.",
  operation_not_allowed:  "Handoff doesn't authorise the operation the desktop tried.",
  missing_capability:     "Desktop is missing a capability the handoff requires.",
  checksum_mismatch:      "Local plan bundle doesn't match the signed checksum.",
  malformed:              "Handoff envelope is malformed.",
};
