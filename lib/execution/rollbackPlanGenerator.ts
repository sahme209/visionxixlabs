/**
 * Rollback Plan Generator.
 *
 * Every meaningful remediation gets a rollback consideration. If a safe
 * rollback path cannot be constructed, the generator says so honestly —
 * it never fabricates "revert with terraform apply" claims when the
 * underlying change isn't reversible.
 */

import type { RemediationCandidate, RollbackRequirement } from "@/lib/remediation/remediationModel";
import { generateTerraformPreview } from "@/lib/execution/terraformPreviewGenerator";
import { generateCliPreview } from "@/lib/execution/cliPreviewGenerator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RollbackComplexity = "trivial" | "moderate" | "complex" | "not_supported";

export interface RollbackPlan {
  id: string;
  remediationCandidateId: string;
  rollbackAvailable: boolean;
  rollbackComplexity: RollbackComplexity;
  rollbackSteps: { ordinal: number; detail: string }[];
  rollbackTerraformPreview?: { fileName: string; hcl: string };
  rollbackCliPreview?:       { cli: string; command: string };
  dataLossRisk: "none" | "low" | "moderate" | "high";
  downtimeRisk: "none" | "low" | "moderate" | "high";
  manualInterventionRequired: boolean;
  verificationAfterRollback: string;
  notes: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function complexityFor(requirement: RollbackRequirement): RollbackComplexity {
  switch (requirement) {
    case "rollback_documented":          return "trivial";
    case "rollback_terraform_revert":    return "moderate";
    case "rollback_cli_revert":          return "moderate";
    case "rollback_redeploy_previous_tag": return "moderate";
    case "rollback_feature_flag_revert": return "trivial";
    case "rollback_not_available":       return "not_supported";
    case "rollback_not_required":        return "trivial";
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateRollbackPlan(candidate: RemediationCandidate): RollbackPlan {
  const id = `rb.${candidate.id}`;
  const complexity = complexityFor(candidate.rollbackRequirement);
  const now = new Date().toISOString();
  const notes: string[] = [];
  const steps: RollbackPlan["rollbackSteps"] = [];

  const baseSteps = (extra: string[]): RollbackPlan["rollbackSteps"] => [
    { ordinal: 1, detail: "Pause any automation that may re-apply the change." },
    { ordinal: 2, detail: "Confirm the operator has the same permissions used to apply." },
    ...extra.map((d, i) => ({ ordinal: i + 3, detail: d })),
  ];

  let rollbackTerraformPreview: RollbackPlan["rollbackTerraformPreview"];
  let rollbackCliPreview: RollbackPlan["rollbackCliPreview"];

  switch (candidate.rollbackRequirement) {
    case "rollback_documented":
      steps.push(...baseSteps([
        "Re-apply the previous Terraform state from your VCS history.",
        "Verify the resource matches the prior configuration.",
      ]));
      break;

    case "rollback_terraform_revert": {
      const tf = generateTerraformPreview(candidate);
      rollbackTerraformPreview = { fileName: tf.fileName.replace(".tf", ".rollback.tf"), hcl: `# Rollback preview — revert by reapplying the prior HCL state.\n# Original change preview generated at ${tf.generatedAt}.\n` };
      steps.push(...baseSteps([
        `Revert the change captured in ${tf.fileName} (re-apply the prior state).`,
        "Confirm terraform apply succeeds with no drift.",
      ]));
      if (tf.manualReviewRequired) {
        notes.push("Underlying remediation requires manual review — rollback is therefore manual.");
      }
      break;
    }

    case "rollback_cli_revert": {
      const cli = generateCliPreview(candidate);
      rollbackCliPreview = { cli: cli.cli, command: `# Rollback preview — re-apply prior state with the same provider CLI.\n# Original command: ${cli.command}` };
      steps.push(...baseSteps([
        "Re-apply the prior CLI state manually.",
        "Run a verification command to confirm the rollback landed.",
      ]));
      break;
    }

    case "rollback_redeploy_previous_tag":
      steps.push(...baseSteps([
        "Identify the previous Docker / artifact tag from the audit timeline.",
        "Trigger a redeploy with the prior tag.",
        "Run smoke tests on the redeployed version.",
      ]));
      break;

    case "rollback_feature_flag_revert":
      steps.push(...baseSteps([
        "Flip the relevant feature flag back to its prior value.",
        "Confirm the rollback is reflected in the dashboard.",
      ]));
      break;

    case "rollback_not_available":
      notes.push("Rollback is not safely available for this remediation. Treat the change as one-way.");
      break;

    case "rollback_not_required":
      notes.push("Remediation is informational / documentation only — no rollback needed.");
      break;
  }

  const available = candidate.rollbackRequirement !== "rollback_not_available";
  const manualInterventionRequired =
    candidate.rollbackRequirement === "rollback_documented"
    || candidate.rollbackRequirement === "rollback_redeploy_previous_tag";

  return {
    id,
    remediationCandidateId: candidate.id,
    rollbackAvailable: available,
    rollbackComplexity: complexity,
    rollbackSteps: steps,
    rollbackTerraformPreview,
    rollbackCliPreview,
    dataLossRisk:   candidate.category === "security_hardening"   ? "low" : "none",
    downtimeRisk:   candidate.category === "configuration_change" ? "low" : "none",
    manualInterventionRequired,
    verificationAfterRollback: "Re-run the underlying scanner / check and confirm the original state is restored.",
    notes,
    generatedAt: now,
  };
}

export function generateRollbackPlans(candidates: RemediationCandidate[]): RollbackPlan[] {
  return candidates.map(generateRollbackPlan);
}
