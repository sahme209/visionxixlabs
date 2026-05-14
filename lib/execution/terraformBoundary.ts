/**
 * Terraform Plan / Apply Boundary.
 *
 * Single typed answer to the question "what Terraform operations does
 * Axiom expose for this provider right now?" The remediation center, the
 * execution detail page, and the desktop UI all read from this — so a
 * fake "Apply now" button can never appear when the boundary says apply
 * is disabled.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerraformBoundaryDecision {
  provider: CloudProvider | "github" | "desktop" | "platform";
  previewAvailable: boolean;
  planAvailable: boolean;
  applyAvailable: boolean;
  whyApplyBlocked: string;
  requiredApproval: "none" | "single_approver" | "two_approvers";
  requiredDesktopReview: boolean;
  requiredAudit: boolean;
  requiredCredentials: string[];
  requiredFeatureFlag: string;
  /** Plain-language summary for the UI. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultDecision(provider: TerraformBoundaryDecision["provider"]): TerraformBoundaryDecision {
  return {
    provider,
    previewAvailable: true,
    planAvailable: true,
    applyAvailable: false,
    whyApplyBlocked: "Live Terraform apply is intentionally disabled until governance + signed audit + approver chain are wired.",
    requiredApproval: "two_approvers",
    requiredDesktopReview: true,
    requiredAudit: true,
    requiredCredentials: [],
    requiredFeatureFlag: "AXIOM_TF_APPLY_ENABLED",
    summary: "Preview and plan are allowed. Apply is disabled by default for safety.",
  };
}

// ---------------------------------------------------------------------------
// Per-provider rules
// ---------------------------------------------------------------------------

export function evaluateTerraformBoundary(input: {
  provider: TerraformBoundaryDecision["provider"];
  /** Whether the provider broker credentials are present. */
  brokerCredentialsPresent: boolean;
  /** Whether the apply feature flag is explicitly turned on. */
  applyFeatureFlagOn: boolean;
  /** Whether the audit pipeline is wired to a tamper-evident sink. */
  auditSinkReady: boolean;
  /** Whether the desktop signing + handoff chain is ready. */
  desktopSigningReady: boolean;
}): TerraformBoundaryDecision {
  const base = defaultDecision(input.provider);

  // Provider-specific required credentials.
  switch (input.provider) {
    case "aws":
      base.requiredCredentials = ["AXIOM_AWS_BROKER_ACCESS_KEY_ID", "AXIOM_AWS_BROKER_SECRET_ACCESS_KEY"];
      break;
    case "azure":
      base.requiredCredentials = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
      break;
    case "gcp":
      base.requiredCredentials = ["GCP_SERVICE_ACCOUNT_JSON", "GCP_PROJECT_ID"];
      break;
    case "github":
      base.requiredCredentials = ["GITHUB_TOKEN"];
      base.requiredApproval = "single_approver";
      break;
    case "desktop":
      base.requiredApproval = "single_approver";
      break;
    default:
      break;
  }

  // Apply is allowed only when every gate is green.
  const allGatesGreen =
    input.brokerCredentialsPresent
    && input.applyFeatureFlagOn
    && input.auditSinkReady
    && input.desktopSigningReady;

  if (allGatesGreen) {
    base.applyAvailable = true;
    base.whyApplyBlocked = "";
    base.summary = "Preview, plan, and apply are available. Apply remains approval-gated.";
    return base;
  }

  const missing: string[] = [];
  if (!input.brokerCredentialsPresent) missing.push(`broker credentials (${base.requiredCredentials.join(", ") || "—"})`);
  if (!input.applyFeatureFlagOn)       missing.push("apply feature flag");
  if (!input.auditSinkReady)           missing.push("audit sink");
  if (!input.desktopSigningReady)      missing.push("desktop signing");
  base.whyApplyBlocked = `Apply blocked: ${missing.join(", ")}.`;
  base.summary = "Preview and plan are allowed. Apply remains disabled.";
  return base;
}
