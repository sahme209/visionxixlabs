/**
 * Security Remediation Approval Orchestrator.
 *
 * Bridges security scanner findings into the typed approval engine.
 * Public-exposure, IAM, encryption, and backup remediations all gate
 * through here.
 */

import type { SecurityCheckResult, SecurityCheckSeverity } from "@/lib/securityScanner/securityScanner";
import { requestApproval, type RequestApprovalOutcome } from "@/lib/approvals/approvalEngine";
import type { ApprovalRisk } from "@/lib/approvals/approvalModel";
import type { ChangeType } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityApprovalRequest {
  finding: SecurityCheckResult;
  approval: RequestApprovalOutcome;
  rollbackSummary: string;
  verificationSummary: string;
  auditEvents: string[];
}

function severityToRisk(s: SecurityCheckSeverity): ApprovalRisk {
  switch (s) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":
    case "info":     return "low";
  }
}

function changeTypeFor(check: SecurityCheckResult): ChangeType {
  switch (check.category) {
    case "iam_overreach":         return "security_hardening";
    case "network_exposure":      return "security_hardening";
    case "encryption_at_rest":    return "security_hardening";
    case "secret_handling":       return "security_hardening";
    case "supply_chain":          return "pipeline_governance";
    case "audit_gap":             return "configuration_change";
    case "backup_resilience":     return "reliability_improvement";
    case "single_region":         return "reliability_improvement";
    case "cloud_misconfig":       return "configuration_change";
    case "app_boundary":          return "configuration_change";
    case "desktop_distribution":  return "documentation_only";
    case "desktop_execution":     return "documentation_only";
  }
}

function verificationFor(check: SecurityCheckResult): string {
  switch (check.category) {
    case "iam_overreach":         return "Re-run IAM trust evaluator and confirm grade ≥ B.";
    case "network_exposure":      return "Re-scan resource and confirm public flag is false / wide ingress removed.";
    case "encryption_at_rest":    return "Confirm encryption-at-rest enabled in provider console.";
    case "secret_handling":       return "Rotate secret and run secret-scan to confirm clean.";
    case "supply_chain":          return "Re-run dependency scan and confirm advisory closed.";
    case "audit_gap":             return "Confirm audit pipeline emits expected events.";
    case "backup_resilience":     return "Confirm backup completed and is restorable.";
    case "single_region":         return "Confirm cross-region redundancy posture.";
    case "cloud_misconfig":       return "Re-run cloud scan and confirm misconfig resolved.";
    case "app_boundary":          return "Confirm boundary control enforced server-side.";
    case "desktop_distribution":  return "Re-verify signing / notarization is published.";
    case "desktop_execution":     return "Confirm desktop local apply remains blocked.";
  }
}

function rollbackFor(check: SecurityCheckResult): string {
  switch (check.category) {
    case "network_exposure":      return "Re-add the previous wide-open rule if absolutely required (not recommended).";
    case "encryption_at_rest":    return "Disable encryption (not recommended — existing keys may persist on prior objects).";
    case "iam_overreach":         return "Restore previous trust policy from VCS history.";
    case "secret_handling":       return "Re-issue rotated secret to dependent systems.";
    default:                       return "Revert the underlying change per the rollback plan in the remediation bundle.";
  }
}

// ---------------------------------------------------------------------------
// Public orchestrator
// ---------------------------------------------------------------------------

export interface OrchestrateSecurityApprovalInput {
  tenantId?: string;
  requesterUserId?: string;
  findings: SecurityCheckResult[];
  /** Whether the affected resource(s) touch production. */
  touchesProduction?: boolean;
  /** Whether the underlying source mode is live. */
  sourceModeLive?: boolean;
}

export interface OrchestrateSecurityApprovalOutcome {
  requests: SecurityApprovalRequest[];
  summary: {
    total: number;
    approvalRequired: number;
    requiresSecurityReviewer: number;
    productionGated: number;
  };
  generatedAt: string;
}

export function orchestrateSecurityApprovals(input: OrchestrateSecurityApprovalInput): OrchestrateSecurityApprovalOutcome {
  const touchesProduction = input.touchesProduction ?? true;
  const sourceModeLive = input.sourceModeLive ?? false;
  const requests: SecurityApprovalRequest[] = [];

  for (const finding of input.findings) {
    if (finding.status === "pass") continue;
    const risk = severityToRisk(finding.severity);
    const changeType = changeTypeFor(finding);

    const approval = requestApproval({
      tenantId: input.tenantId,
      requesterUserId: input.requesterUserId,
      sourceType: "security_finding",
      sourceId: finding.id,
      provider: finding.provider ?? "platform",
      risk,
      changeSummary: finding.title,
      affectedResources: finding.affectedResources ?? [],
      simulationSummary: undefined,
      blastRadius: risk === "critical" || risk === "high" ? "high" : "medium",
      rollbackSummary: rollbackFor(finding),
      verificationSummary: verificationFor(finding),
      policyInput: {
        sourceType: "security_finding",
        changeType,
        risk,
        touchesProduction,
        unknownImpact: finding.status === "unknown",
        sourceModeLive,
      },
    });

    requests.push({
      finding,
      approval,
      rollbackSummary: rollbackFor(finding),
      verificationSummary: verificationFor(finding),
      auditEvents: [`audit.security.approval_request.${finding.id}`],
    });
  }

  return {
    requests,
    summary: {
      total: requests.length,
      approvalRequired:          requests.filter((r) => r.approval.approvalRequired).length,
      requiresSecurityReviewer:  requests.filter((r) => r.approval.policy.additionalReviewers.includes("security_reviewer")).length,
      productionGated:           requests.filter((r) => r.approval.policy.additionalReviewers.includes("production_owner")).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
