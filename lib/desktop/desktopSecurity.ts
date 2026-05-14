/**
 * Desktop runtime security model.
 *
 * The desktop client is a privileged actor: it holds OS-keychain credentials,
 * runs local Terraform/CLI commands, and executes approved plans. It must
 * never become a backdoor around the platform's governance.
 *
 * This module captures the typed contracts the rest of the platform reads
 * when deciding whether a handoff is trustworthy.
 */

import type { OrganizationId, UserId, ExecutionPlanId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Trust posture
// ---------------------------------------------------------------------------

export type DesktopTrustState =
  | "untrusted"           // No paired desktop registered
  | "pending_pairing"     // Pairing code issued, awaiting confirmation
  | "trusted"             // Paired and within policy
  | "version_blocked"     // Desktop version older than allowed
  | "signature_blocked"   // Binary signature failed verification
  | "policy_blocked"      // Tenant policy disabled desktop execution
  | "revoked";            // Pairing revoked by an admin

export type DesktopOsKind = "macos" | "windows" | "linux";

export type DesktopReleaseChannel = "stable" | "beta" | "preview";

/**
 * Trust profile a tenant publishes for its desktop fleet. Used by the
 * web app when deciding whether to issue a handoff payload.
 */
export interface DesktopTrustProfile {
  organizationId: OrganizationId;
  /** Minimum acceptable desktop semver. */
  minVersion: string;
  /** Acceptable release channels. */
  allowedChannels: DesktopReleaseChannel[];
  /** Whether local Terraform execution is permitted at all. */
  allowLocalTerraform: boolean;
  /** Whether local CLI shell-out is permitted. */
  allowLocalCli: boolean;
  /** Whether desktop can run when offline (no audit sync). */
  allowOfflineExecution: boolean;
  /** Maximum minutes the desktop can run without re-syncing audit/events. */
  maxOfflineMinutes: number;
  /** Workstation mode — restricts elevated operations to admin users. */
  enterpriseWorkstationMode: boolean;
}

export const DEFAULT_DESKTOP_TRUST_PROFILE: Omit<DesktopTrustProfile, "organizationId"> = {
  minVersion: "0.1.0",
  allowedChannels: ["stable"],
  allowLocalTerraform: true,
  allowLocalCli: true,
  allowOfflineExecution: false,
  maxOfflineMinutes: 15,
  enterpriseWorkstationMode: false,
};

// ---------------------------------------------------------------------------
// Paired desktop
// ---------------------------------------------------------------------------

export interface PairedDesktop {
  desktopId: string;
  organizationId: OrganizationId;
  userId: UserId;
  os: DesktopOsKind;
  channel: DesktopReleaseChannel;
  version: string;
  /** Fingerprint of the install — derived from machine id + install seed. */
  fingerprint: string;
  state: DesktopTrustState;
  pairedAt: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
  /** When pairing was revoked, if applicable. */
  revokedAt?: string;
  /** Set when the binary's code signature could not be verified. */
  signatureWarning?: string;
}

// ---------------------------------------------------------------------------
// Handoff payload
// ---------------------------------------------------------------------------

/**
 * The signed envelope the web app produces and the desktop verifies before
 * acting. Signature material itself is opaque to this module — the signing
 * implementation lives next to the key management layer.
 */
export interface DesktopHandoff {
  handoffId: string;
  organizationId: OrganizationId;
  userId: UserId;
  desktopId: string;
  executionPlanId: ExecutionPlanId;
  /** ISO timestamp when this handoff expires. */
  expiresAt: string;
  /** Single-use nonce — desktop rejects replays. */
  nonce: string;
  /** Plan checksum so desktop can verify it matches what was approved. */
  planChecksum: string;
  /** Signature over the canonical JSON form of the fields above. */
  signature: string;
}

// ---------------------------------------------------------------------------
// Verification result
// ---------------------------------------------------------------------------

export interface HandoffVerification {
  ok: boolean;
  failureReason?:
    | "expired"
    | "replayed"
    | "wrong_tenant"
    | "wrong_user"
    | "wrong_desktop"
    | "signature_invalid"
    | "checksum_mismatch"
    | "trust_state_blocked";
  desktopState?: DesktopTrustState;
}

/**
 * Verify a handoff payload against the paired desktop and current trust
 * profile. Pure function — does not perform IO. Callers supply the freshly-
 * loaded `paired` and `profile`; replay detection is via the `seenNonces`
 * set the caller controls.
 */
export function verifyHandoff(input: {
  handoff: DesktopHandoff;
  paired: PairedDesktop;
  profile: DesktopTrustProfile;
  seenNonces: Set<string>;
  now?: Date;
  expectedSignature: string;
  expectedPlanChecksum: string;
}): HandoffVerification {
  const now = (input.now ?? new Date()).getTime();
  const expiresMs = new Date(input.handoff.expiresAt).getTime();
  if (now > expiresMs) return { ok: false, failureReason: "expired", desktopState: input.paired.state };
  if (input.seenNonces.has(input.handoff.nonce)) return { ok: false, failureReason: "replayed", desktopState: input.paired.state };
  if (input.handoff.organizationId !== input.paired.organizationId) return { ok: false, failureReason: "wrong_tenant" };
  if (input.handoff.userId !== input.paired.userId) return { ok: false, failureReason: "wrong_user" };
  if (input.handoff.desktopId !== input.paired.desktopId) return { ok: false, failureReason: "wrong_desktop" };
  if (input.handoff.signature !== input.expectedSignature) return { ok: false, failureReason: "signature_invalid" };
  if (input.handoff.planChecksum !== input.expectedPlanChecksum) return { ok: false, failureReason: "checksum_mismatch" };
  if (input.paired.state !== "trusted") return { ok: false, failureReason: "trust_state_blocked", desktopState: input.paired.state };

  // Profile-level gates
  const versionOk = semverGte(input.paired.version, input.profile.minVersion);
  if (!versionOk) return { ok: false, failureReason: "trust_state_blocked", desktopState: "version_blocked" };
  if (!input.profile.allowedChannels.includes(input.paired.channel)) {
    return { ok: false, failureReason: "trust_state_blocked", desktopState: "version_blocked" };
  }
  return { ok: true, desktopState: input.paired.state };
}

/** Crude semver compare — major.minor.patch. Returns true when a ≥ b. */
function semverGte(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return true;
    if (da < db) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface DesktopTrustDisplay {
  label: string;
  detail: string;
  pill: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

export function displayFor(state: DesktopTrustState): DesktopTrustDisplay {
  switch (state) {
    case "untrusted":         return { label: "No desktop paired",     detail: "No desktop runtime is associated with this organization.", pill: "Unpaired", semantic: "neutral" };
    case "pending_pairing":   return { label: "Pairing pending",       detail: "Awaiting pairing-code confirmation from the desktop.",      pill: "Pairing",  semantic: "running" };
    case "trusted":           return { label: "Trusted",               detail: "Desktop is paired and within trust policy.",                pill: "Trusted",  semantic: "success" };
    case "version_blocked":   return { label: "Version blocked",       detail: "Desktop version is older than the tenant minimum.",        pill: "Blocked",  semantic: "warning" };
    case "signature_blocked": return { label: "Signature blocked",     detail: "Desktop binary signature could not be verified.",          pill: "Blocked",  semantic: "error" };
    case "policy_blocked":    return { label: "Policy blocked",        detail: "Tenant policy disables desktop execution.",                 pill: "Blocked",  semantic: "warning" };
    case "revoked":           return { label: "Revoked",               detail: "Desktop pairing has been revoked.",                          pill: "Revoked",  semantic: "error" };
  }
}
