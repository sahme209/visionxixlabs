/**
 * Desktop execution handoff — packages an approved execution plan into a
 * portable bundle the desktop app can open, review, and (later) execute
 * locally with the user's own AWS CLI credentials.
 *
 * Web-side responsibility: produce the bundle + handoff URL.
 * Desktop-side responsibility: open the bundle, store it in local audit,
 * surface review UI, and optionally execute via the local runtime.
 *
 * No execution happens on the web side. The bundle is metadata + artifacts.
 */

import type { ExecutionPlanCandidate } from "@/lib/execution/executionPlanBuilder";
import type { TerraformArtifact } from "@/lib/execution/terraformGenerator";
import type { CliArtifact } from "@/lib/execution/cliGenerator";
import type { RollbackPlan } from "@/lib/execution/rollbackPlanGenerator";
import type { VerificationSpec } from "@/lib/execution/verificationEngine";

// ---------------------------------------------------------------------------
// Handoff bundle types
// ---------------------------------------------------------------------------

export type HandoffStatus = "ready" | "delivered" | "rejected_by_desktop" | "expired";

export interface HandoffBundle {
  /** Globally unique handoff ID — the desktop opens this. */
  id: string;
  /** Underlying execution plan. */
  plan: ExecutionPlanCandidate;
  /** Generated Terraform artifact(s). */
  terraform?: TerraformArtifact;
  /** Generated CLI artifact(s). */
  cli?: CliArtifact;
  /** Rollback plan. */
  rollback?: RollbackPlan;
  /** Verification spec. */
  verification?: VerificationSpec;
  /** Approver identity at the moment of handoff. */
  approver: string;
  /** When the handoff bundle was packaged. */
  preparedAt: string;
  /** When the bundle expires if not opened. */
  expiresAt: string;
  /** Current handoff status. */
  status: HandoffStatus;
  /** Manifest describing every artifact + integrity hash placeholder. */
  manifest: HandoffManifestEntry[];
  /** Web → Desktop deep link to open this bundle. */
  desktopUrl: string;
  /** Direct download URL for the .axiomplan archive. */
  downloadUrl: string;
}

export interface HandoffManifestEntry {
  path: string;
  kind: "terraform" | "cli" | "rollback" | "verification" | "metadata";
  bytes: number;
  /** Placeholder for SHA256 — set by the bundle serializer. */
  sha256?: string;
}

// ---------------------------------------------------------------------------
// Handoff packaging
// ---------------------------------------------------------------------------

export interface PackageOptions {
  approver: string;
  /** Expiry window in hours. Default 24h. */
  expiryHours?: number;
  /** Optional Terraform artifact. */
  terraform?: TerraformArtifact;
  /** Optional CLI artifact. */
  cli?: CliArtifact;
  /** Optional rollback plan. */
  rollback?: RollbackPlan;
  /** Optional verification spec. */
  verification?: VerificationSpec;
}

/**
 * Package an approved execution plan into a handoff bundle. No execution
 * occurs — this only constructs the metadata + manifest the desktop app
 * will consume.
 */
export function packageHandoff(plan: ExecutionPlanCandidate, options: PackageOptions): HandoffBundle {
  const id = `handoff_${plan.id}_${Date.now().toString(36)}`;
  const preparedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (options.expiryHours ?? 24) * 3600_000).toISOString();

  const manifest: HandoffManifestEntry[] = [
    { path: "plan.json", kind: "metadata", bytes: estimateJsonBytes(plan) },
  ];

  if (options.terraform) {
    manifest.push({ path: options.terraform.filename, kind: "terraform", bytes: options.terraform.bytes || options.terraform.content.length });
  }
  if (options.cli) {
    manifest.push({ path: options.cli.filename, kind: "cli", bytes: options.cli.bytes || options.cli.content.length });
  }
  if (options.rollback) {
    manifest.push({ path: "rollback.json", kind: "rollback", bytes: estimateJsonBytes(options.rollback) });
  }
  if (options.verification) {
    manifest.push({ path: "verification.json", kind: "verification", bytes: estimateJsonBytes(options.verification) });
  }

  const desktopUrl = `axiom://handoff/${id}`; // Tauri shell registers this scheme
  const downloadUrl = `/api/desktop/handoff/${id}/download`;

  return {
    id,
    plan,
    terraform: options.terraform,
    cli: options.cli,
    rollback: options.rollback,
    verification: options.verification,
    approver: options.approver,
    preparedAt,
    expiresAt,
    status: "ready",
    manifest,
    desktopUrl,
    downloadUrl,
  };
}

/**
 * Mark a bundle as delivered (desktop app reported receipt). Returns a new
 * bundle — does not mutate input.
 */
export function markDelivered(bundle: HandoffBundle): HandoffBundle {
  return { ...bundle, status: "delivered" };
}

/**
 * Mark a bundle as rejected by the desktop (e.g., signature mismatch).
 */
export function markRejected(bundle: HandoffBundle, reason: string): HandoffBundle {
  return { ...bundle, status: "rejected_by_desktop", manifest: bundle.manifest, plan: { ...bundle.plan, blockers: [...bundle.plan.blockers, `Desktop rejected handoff: ${reason}`] } };
}

/**
 * Compute whether a bundle has expired.
 */
export function isExpired(bundle: HandoffBundle, now: Date = new Date()): boolean {
  return new Date(bundle.expiresAt).getTime() < now.getTime();
}

/**
 * Total size of all artifacts in the bundle.
 */
export function totalBundleBytes(bundle: HandoffBundle): number {
  return bundle.manifest.reduce((s, m) => s + m.bytes, 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateJsonBytes(obj: unknown): number {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
}
