/**
 * Web-to-desktop handoff contract — typed payload + canonical-JSON
 * canonicaliser.
 *
 * This is the *shape* every handoff has on the wire. The signer lives in
 * `handoffSigner.ts` and produces an HMAC-SHA256 signature over the
 * canonical JSON form. The validator lives in `handoffValidator.ts` and
 * verifies the signature, expiry, replay, and tenant/user scope.
 *
 * Hard rules encoded:
 *  - Every handoff carries a tenant id + user id + execution-plan id
 *  - Every handoff has an explicit expiry (no defaults beyond 1 hour)
 *  - Every handoff carries the policy-decision id it was issued under
 *  - Every handoff carries a single-use nonce for replay protection
 *  - Every handoff carries `allowedOperation` so a "review-only" handoff
 *    can never be opened for apply
 *  - No credentials, tokens, or raw secrets are part of the payload —
 *    artifact references are URIs, not blobs
 */

import type {
  ApprovalId,
  ExecutionPlanId,
  OrganizationId,
  PolicyRuleId,
  UserId,
} from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Versioned contract
// ---------------------------------------------------------------------------

/** Bump when the wire shape changes; the validator refuses unknown versions. */
export const HANDOFF_CONTRACT_VERSION = 1 as const;

export type HandoffOperation =
  | "review_only"          // Open the bundle; render Terraform/CLI/rollback. No execution.
  | "preview_local"        // Run `terraform plan` locally. No mutation.
  | "execute_local"        // Run apply locally. Approval-gated.
  | "verify_only";         // Run verification checks against current state.

export type DesktopCapabilityRequirement =
  | "review"
  | "preview"
  | "verify"
  | "apply"
  | "audit_sync"
  | "keychain";

export interface HandoffArtifactRef {
  /** Stable id matching the manifest entry. */
  id: string;
  kind: "terraform" | "cli" | "rollback" | "verification" | "metadata";
  /** Path inside the bundle archive. */
  path: string;
  /** Size in bytes — the desktop verifies the downloaded file matches. */
  bytes: number;
  /** SHA-256 of the file content. */
  sha256: string;
}

export interface HandoffResourceSummary {
  /** Number of resources the plan touches. */
  total: number;
  /** Counts by provider. */
  byProvider: Record<string, number>;
  /** Honest blast-radius classification. */
  blastRadius: "contained" | "moderate" | "broad";
}

// ---------------------------------------------------------------------------
// Payload (unsigned — fed to the signer)
// ---------------------------------------------------------------------------

export interface HandoffPayload {
  /** Wire version — refuses unknown values at the validator. */
  version: typeof HANDOFF_CONTRACT_VERSION;

  /** Globally unique handoff id. */
  handoffId: string;

  /** Tenant scope — desktop refuses if it doesn't match the paired user's org. */
  organizationId: OrganizationId;

  /** The user who initiated the handoff. */
  userId: UserId;

  /** The execution plan this handoff is for. */
  executionPlanId: ExecutionPlanId;

  /** The single operation this handoff authorises — the validator rejects any
   *  other operation attempted by the desktop. */
  allowedOperation: HandoffOperation;

  /** The policy decision that allowed this handoff to be issued. */
  policyDecisionId: PolicyRuleId;

  /** The approval that cleared the plan (when allowedOperation requires it). */
  approvalId?: ApprovalId;

  /** Capabilities the desktop must report to process this handoff. */
  requiredCapabilities: DesktopCapabilityRequirement[];

  /** Issued at (ISO). */
  issuedAt: string;

  /** Expiry (ISO). Validator refuses past this time. Max TTL is enforced in signer. */
  expiresAt: string;

  /** Single-use nonce — desktop must record + refuse replays. */
  nonce: string;

  /** Plan checksum so desktop can verify the local copy matches what was approved. */
  planChecksum: string;

  /** Summary of what the plan affects — no secrets, no raw provider data. */
  resourceSummary: HandoffResourceSummary;

  /** Artifact references (URIs/paths + checksums). Never inline blobs. */
  artifacts: HandoffArtifactRef[];

  /** Whether the desktop must upload an audit-sync confirmation when done. */
  auditSyncRequired: boolean;
}

// ---------------------------------------------------------------------------
// Signed envelope (what travels on the wire)
// ---------------------------------------------------------------------------

export interface SignedHandoff {
  payload: HandoffPayload;
  /** Hex HMAC-SHA256 over the canonical JSON form of `payload`. */
  signature: string;
  /** Algorithm tag — future-proofs over RS256 etc. */
  algorithm: "HS256";
  /** Key id — supports rotation without invalidating in-flight handoffs. */
  keyId: string;
}

// ---------------------------------------------------------------------------
// Canonical JSON
// ---------------------------------------------------------------------------

/**
 * Produce a stable, deterministic JSON string over the payload so the signer
 * and validator hash the same bytes regardless of key ordering or object
 * insertion order.
 *
 * Rules: object keys sorted ASCII-ascending at every depth; no whitespace.
 */
export function canonicaliseHandoff(payload: HandoffPayload): string {
  return canonicalise(payload);
}

function canonicalise(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalise).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalise((value as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  }
  return "null";
}

// ---------------------------------------------------------------------------
// Display labels — for the UI
// ---------------------------------------------------------------------------

export const HANDOFF_OPERATION_LABEL: Record<HandoffOperation, string> = {
  review_only:    "Review only",
  preview_local:  "Local preview",
  execute_local:  "Local execute (approval-gated)",
  verify_only:    "Verify only",
};

export const HANDOFF_OPERATION_DESCRIPTION: Record<HandoffOperation, string> = {
  review_only:    "Open the bundle and render Terraform / CLI / rollback. No mutation possible.",
  preview_local:  "Run `terraform plan` locally with the user's credentials. Side-effect-free.",
  execute_local:  "Run `terraform apply` locally. Requires a granted approval + tenant policy allowance + reachable audit sink.",
  verify_only:    "Run verification checks against the current environment. Side-effect-free.",
};
