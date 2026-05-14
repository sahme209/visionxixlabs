/**
 * Credential metadata, rotation, and revocation contracts.
 *
 * The existing `credentialVault.ts` handles AES-256-GCM encrypt/decrypt of
 * sensitive blobs. This module sits above it: it describes *what* is stored,
 * how it's classified (static key vs delegated role vs OAuth grant), when it
 * was rotated, and the revocation surface customers can act on without a
 * support call.
 *
 * Enterprise reviewers ask three questions:
 *  1. Do you store keys? (Answer: prefer delegated trust; static only as fallback)
 *  2. Can we rotate? (Answer: rotation metadata + UI control)
 *  3. Can we revoke? (Answer: hard revoke flips state + emits audit)
 *
 * This file gives the API/UI a typed answer to all three.
 */

import type { ConnectorId, OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type CredentialMaterial =
  | "aws_role_arn"           // delegated trust — preferred
  | "aws_static_key"         // long-lived secret — fallback
  | "azure_service_principal"
  | "azure_managed_identity" // preferred
  | "gcp_service_account"
  | "gcp_workload_identity"  // preferred
  | "github_app_installation"// preferred
  | "github_oauth"
  | "github_pat"             // fallback
  | "terraform_cloud_token"
  | "slack_oauth"
  | "pagerduty_api_key"
  | "servicenow_oauth"
  | "desktop_local_token";

/** Whether this credential kind avoids long-lived shared secrets. */
export function isDelegated(material: CredentialMaterial): boolean {
  switch (material) {
    case "aws_role_arn":
    case "azure_managed_identity":
    case "gcp_workload_identity":
    case "github_app_installation":
    case "slack_oauth":
    case "servicenow_oauth":
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type CredentialState =
  | "active"
  | "rotation_due"     // older than rotation policy window
  | "rotation_overdue" // past hard rotation deadline — restricted
  | "revoked"          // user/admin revoked
  | "compromised";     // marked compromised — execution blocked

export interface CredentialRotationPolicy {
  /** Days before "rotation_due" is signalled. */
  warnAfterDays: number;
  /** Days after which the credential is considered "rotation_overdue". */
  enforceAfterDays: number;
}

/** Sensible default: warn at 60 days, enforce at 90. */
export const DEFAULT_ROTATION_POLICY: CredentialRotationPolicy = {
  warnAfterDays: 60,
  enforceAfterDays: 90,
};

// ---------------------------------------------------------------------------
// Metadata record
// ---------------------------------------------------------------------------

export interface CredentialMetadata {
  organizationId: OrganizationId;
  connectorId: ConnectorId;
  material: CredentialMaterial;
  state: CredentialState;
  /** Reference to the encrypted blob in the vault — not the secret itself. */
  vaultRef: string;
  /** Last successful validation against the provider. */
  lastValidatedAt?: string;
  /** When the credential was last rotated (created or re-issued). */
  lastRotatedAt: string;
  /** Who last rotated/revoked the credential. */
  lastActorId?: UserId;
  /** Optional human-friendly label. */
  label?: string;
  /** Free-form structured notes — redacted before display. */
  notes?: string;
  /** Tracking the rotation policy override, if any. */
  rotationPolicy?: CredentialRotationPolicy;
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

/**
 * Derive whether a credential's age has crossed the rotation policy window.
 * Pure function — does not mutate.
 */
export function deriveRotationState(
  metadata: CredentialMetadata,
  now: Date = new Date()
): { state: CredentialState; daysSinceRotation: number; isOverdue: boolean } {
  if (metadata.state === "revoked" || metadata.state === "compromised") {
    return { state: metadata.state, daysSinceRotation: 0, isOverdue: false };
  }
  const policy = metadata.rotationPolicy ?? DEFAULT_ROTATION_POLICY;
  const rotated = new Date(metadata.lastRotatedAt).getTime();
  const days = Math.max(0, Math.floor((now.getTime() - rotated) / (24 * 60 * 60 * 1000)));
  if (days >= policy.enforceAfterDays) return { state: "rotation_overdue", daysSinceRotation: days, isOverdue: true };
  if (days >= policy.warnAfterDays) return { state: "rotation_due", daysSinceRotation: days, isOverdue: false };
  return { state: "active", daysSinceRotation: days, isOverdue: false };
}

// ---------------------------------------------------------------------------
// Revocation outcome
// ---------------------------------------------------------------------------

export interface RevocationResult {
  ok: boolean;
  previousState: CredentialState;
  newState: CredentialState;
  revokedAt: string;
  /** Set when the upstream provider also confirmed revocation. */
  upstreamRevoked: boolean;
}

/**
 * Mark a credential revoked at the metadata layer. The caller is responsible
 * for also revoking upstream where supported (OAuth refresh, GitHub app
 * uninstall, IAM trust policy update).
 */
export function markRevoked(metadata: CredentialMetadata, actorId: UserId, upstreamRevoked: boolean): { metadata: CredentialMetadata; result: RevocationResult } {
  const now = new Date().toISOString();
  return {
    metadata: { ...metadata, state: "revoked", lastActorId: actorId },
    result: {
      ok: true,
      previousState: metadata.state,
      newState: "revoked",
      revokedAt: now,
      upstreamRevoked,
    },
  };
}

/** Mark a credential compromised — blocks execution until rotated. */
export function markCompromised(metadata: CredentialMetadata, actorId: UserId): CredentialMetadata {
  return { ...metadata, state: "compromised", lastActorId: actorId };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface CredentialDisplay {
  label: string;
  detail: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

export function displayFor(state: CredentialState): CredentialDisplay {
  switch (state) {
    case "active":
      return { label: "Active",            detail: "Credential is valid and within rotation policy.", pill: "Active",   semantic: "success" };
    case "rotation_due":
      return { label: "Rotation due",      detail: "Credential is older than the warn threshold.",    pill: "Rotate",   semantic: "warning" };
    case "rotation_overdue":
      return { label: "Rotation overdue",  detail: "Credential is past the rotation deadline — execution restricted.", pill: "Overdue", semantic: "error" };
    case "revoked":
      return { label: "Revoked",           detail: "Credential has been revoked by an admin.",        pill: "Revoked",  semantic: "neutral" };
    case "compromised":
      return { label: "Compromised",       detail: "Credential is marked compromised — execution blocked.", pill: "Blocked", semantic: "error" };
  }
}

export function materialDisplay(material: CredentialMaterial): string {
  const map: Record<CredentialMaterial, string> = {
    aws_role_arn:             "AWS IAM Role (delegated)",
    aws_static_key:           "AWS Access Key (static)",
    azure_service_principal:  "Azure Service Principal",
    azure_managed_identity:   "Azure Managed Identity (delegated)",
    gcp_service_account:      "GCP Service Account",
    gcp_workload_identity:    "GCP Workload Identity (delegated)",
    github_app_installation:  "GitHub App Installation",
    github_oauth:             "GitHub OAuth",
    github_pat:               "GitHub Personal Access Token",
    terraform_cloud_token:    "Terraform Cloud token",
    slack_oauth:              "Slack OAuth",
    pagerduty_api_key:        "PagerDuty API key",
    servicenow_oauth:         "ServiceNow OAuth",
    desktop_local_token:      "Desktop runtime local token",
  };
  return map[material];
}
