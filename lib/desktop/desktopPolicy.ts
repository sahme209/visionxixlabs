/**
 * Desktop-side governance policy.
 *
 * Typed evaluation of what the desktop runtime is allowed to do given:
 * the tenant's autonomy level, the desktop runtime mode (connected vs
 * workstation), and the per-handoff bundle's policy requirements.
 *
 * The desktop shell consumes this to gate local Terraform / CLI execution
 * and audit sync.
 */

import type { TenantAutonomy } from "@/lib/governance/autonomyLevels";
import type { PolicyEvaluationResult } from "@/lib/governance/policyEngine";

export interface DesktopExecutionPolicy {
  /** Can the desktop run local Terraform applies? */
  localTerraformAllowed: boolean;
  /** Can the desktop run local CLI commands that mutate? */
  localCliMutationAllowed: boolean;
  /** Does the desktop require local user confirmation per apply? */
  requireLocalConfirmation: boolean;
  /** Is offline audit sync required (skipped when in workstation mode)? */
  requireAuditSync: boolean;
  /** Are local secrets permitted on disk? */
  localSecretsPermitted: boolean;
  /** Is the desktop binary version trusted (signed + non-revoked)? */
  desktopVersionTrusted: boolean;
  /** Plain-English reasoning the user sees. */
  reason: string;
  /** Safe next action when the desktop is blocked. */
  safeNextAction: string;
}

export interface DesktopPolicyInput {
  autonomy: TenantAutonomy;
  /** Connected vs workstation (no outbound network). */
  mode: "connected" | "workstation";
  /** Tauri shell version, if reported. */
  desktopVersion?: string;
  /** Code-signed + notarized? */
  signed?: boolean;
  /** Cloud-side policy result for the plan being handed off. */
  cloudPolicy?: PolicyEvaluationResult;
}

/**
 * Compute the desktop execution policy for a given runtime state.
 */
export function evaluateDesktopPolicy(input: DesktopPolicyInput): DesktopExecutionPolicy {
  const trusted = input.signed === true && Boolean(input.desktopVersion);
  const allowLocalApply = input.autonomy.level >= 4; // Level 4+ allows execution
  const allowMutation = allowLocalApply && trusted;
  const requireConfirm = true; // Always require local confirmation for safety
  const requireSync = input.mode !== "workstation"; // Workstation mode forgoes outbound sync
  const allowSecrets = input.mode === "workstation"; // Only when offline

  // Cloud-side block propagates
  if (input.cloudPolicy?.blocked) {
    return {
      localTerraformAllowed: false,
      localCliMutationAllowed: false,
      requireLocalConfirmation: requireConfirm,
      requireAuditSync: requireSync,
      localSecretsPermitted: allowSecrets,
      desktopVersionTrusted: trusted,
      reason: `Cloud-side policy blocked this plan. Desktop cannot apply: ${input.cloudPolicy.reason}`,
      safeNextAction: "Address the cloud-side block before retrying from desktop.",
    };
  }

  if (!trusted) {
    return {
      localTerraformAllowed: false,
      localCliMutationAllowed: false,
      requireLocalConfirmation: requireConfirm,
      requireAuditSync: requireSync,
      localSecretsPermitted: false,
      desktopVersionTrusted: false,
      reason: "Desktop binary is unsigned or version not reported.",
      safeNextAction: "Re-install the latest signed desktop build from /download.",
    };
  }

  if (!allowLocalApply) {
    return {
      localTerraformAllowed: false,
      localCliMutationAllowed: false,
      requireLocalConfirmation: requireConfirm,
      requireAuditSync: requireSync,
      localSecretsPermitted: allowSecrets,
      desktopVersionTrusted: trusted,
      reason: `Tenant autonomy level (${input.autonomy.level}) does not permit local apply.`,
      safeNextAction: "Raise autonomy to Level 4 (Assisted Execute) via tenant policy, or use cloud-side apply.",
    };
  }

  return {
    localTerraformAllowed: true,
    localCliMutationAllowed: allowMutation,
    requireLocalConfirmation: requireConfirm,
    requireAuditSync: requireSync,
    localSecretsPermitted: allowSecrets,
    desktopVersionTrusted: trusted,
    reason: "Desktop apply allowed under current autonomy + signed runtime. Local user confirmation will still be required per plan.",
    safeNextAction: "Open the plan in the desktop app and confirm locally to apply.",
  };
}
