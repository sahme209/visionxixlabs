/**
 * Release Approval Orchestrator.
 *
 * Bridges release readiness blockers into the typed approval engine.
 * Every release-blocking action that needs governance (branch protection,
 * required checks, rollback acceptance, env promotion, release unblock)
 * goes through here.
 */

import type { ReadinessBlocker } from "@/lib/releaseops/releaseReadiness";
import { requestApproval, type RequestApprovalOutcome } from "@/lib/approvals/approvalEngine";
import type { ApprovalRisk } from "@/lib/approvals/approvalModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReleaseApprovalRequest {
  blocker: ReadinessBlocker;
  approval: RequestApprovalOutcome;
  /** Plain-language verification / rollback / audit notes. */
  verificationSummary: string;
  rollbackSummary: string;
  auditEvents: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityToRisk(s: ReadinessBlocker["severity"]): ApprovalRisk {
  switch (s) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":
    case "info":     return "low";
  }
}

function verificationFor(blocker: ReadinessBlocker): string {
  switch (blocker.kind) {
    case "branch_protection_missing":
    case "branch_protection_weak":     return "Re-validate branch protection on the target branch.";
    case "signed_commits_missing":     return "Confirm signed-commit enforcement on the target branch.";
    case "required_checks_missing":    return "Confirm required status-check contexts are present.";
    case "workflow_failing":           return "Re-run the failing workflow and confirm green.";
    case "stale_sync":                 return "Trigger a GitHub sync and confirm readiness re-scored.";
    case "rollback_unverified":        return "Run a rollback drill against the most recent tag.";
    case "env_drift":                  return "Re-compare environment config against IaC and confirm no drift.";
    case "no_deployment_approval":     return "Re-validate that deployment approvals are required for this env.";
  }
}

function rollbackFor(blocker: ReadinessBlocker): string {
  switch (blocker.kind) {
    case "branch_protection_missing":
    case "branch_protection_weak":     return "Revert branch protection to previous configuration via GitHub UI / API.";
    case "signed_commits_missing":     return "Disable signed-commit requirement (not recommended — reduces audit posture).";
    case "required_checks_missing":    return "Remove the added required check context.";
    case "workflow_failing":           return "Redeploy the previous tag from the pipeline.";
    case "stale_sync":                 return "No rollback needed — fresh sync is the safe action.";
    case "rollback_unverified":        return "Run the documented rollback drill before re-deploying.";
    case "env_drift":                  return "Re-apply IaC to bring the environment back to the declared state.";
    case "no_deployment_approval":     return "Re-enable required reviewer for the env in question.";
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export interface OrchestrateReleaseApprovalInput {
  tenantId?: string;
  requesterUserId?: string;
  blockers: ReadinessBlocker[];
  /** True if the affected repo / branch touches production. */
  touchesProduction?: boolean;
  /** True when the underlying source mode is live. */
  sourceModeLive?: boolean;
}

export interface OrchestrateReleaseApprovalOutcome {
  requests: ReleaseApprovalRequest[];
  summary: { total: number; approvalRequired: number; preview: number; productionGated: number };
  generatedAt: string;
}

export function orchestrateReleaseApprovals(input: OrchestrateReleaseApprovalInput): OrchestrateReleaseApprovalOutcome {
  const touchesProduction = input.touchesProduction ?? true;
  const sourceModeLive = input.sourceModeLive ?? false;
  const requests: ReleaseApprovalRequest[] = [];

  for (const blocker of input.blockers) {
    const risk = severityToRisk(blocker.severity);
    const approval = requestApproval({
      tenantId: input.tenantId,
      requesterUserId: input.requesterUserId,
      sourceType: "release_blocker",
      sourceId: blocker.id,
      provider: "github",
      risk,
      changeSummary: blocker.title,
      affectedResources: [blocker.repoId],
      simulationSummary: undefined,
      blastRadius: touchesProduction ? "high" : "medium",
      rollbackSummary: rollbackFor(blocker),
      verificationSummary: verificationFor(blocker),
      policyInput: {
        sourceType: "release_blocker",
        changeType: "release",
        risk,
        touchesProduction,
        unknownImpact: blocker.kind === "rollback_unverified",
        sourceModeLive,
      },
    });

    requests.push({
      blocker,
      approval,
      verificationSummary: verificationFor(blocker),
      rollbackSummary: rollbackFor(blocker),
      auditEvents: [`audit.release.approval_request.${blocker.id}`],
    });
  }

  return {
    requests,
    summary: {
      total: requests.length,
      approvalRequired: requests.filter((r) => r.approval.approvalRequired).length,
      preview: requests.filter((r) => !r.approval.policy.executionAllowedLater).length,
      productionGated: requests.filter((r) => r.approval.policy.additionalReviewers.includes("production_owner")).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
