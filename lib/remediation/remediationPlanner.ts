/**
 * Remediation Planner.
 *
 * Converts findings / scanner results / release blockers / coverage gaps
 * into typed `RemediationCandidate` rows. Pure planner — never executes.
 *
 * Designed to be called by:
 *  - the remediation pipeline (ingest → candidate)
 *  - the brain (to surface "what can Axiom safely fix?")
 *  - the security scanner / ReleaseOps integrations (to keep findings
 *    and release blockers wired into the same remediation surface)
 */

import type {
  RemediationCandidate,
  ChangeType,
  RemediationRisk,
  PolicyVerdict,
  ApprovalRequirement,
  RollbackRequirement,
  VerificationRequirement,
  DesktopEligibility,
  AutomationLevel,
} from "@/lib/remediation/remediationModel";
import { candidateIdFor } from "@/lib/remediation/remediationModel";
import type { SecurityScanOutcome, SecurityCheckResult } from "@/lib/securityScanner/securityScanner";
import type { ReadinessBlocker, ReleaseReadiness } from "@/lib/releaseops/releaseReadiness";
import type { CapabilityCoverageRow } from "@/lib/cloud/capabilityCoverageMap";
import type { CoverageGap } from "@/lib/cloud/coverageGapAnalyzer";

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export interface RemediationPlannerInput {
  tenantId?: string;
  securityScan?: SecurityScanOutcome;
  releaseReadiness?: ReleaseReadiness;
  coverageGaps?: CoverageGap[];
  /** Optional override — pass coverage rows when planner runs in a non-default tenant. */
  coverageRows?: CapabilityCoverageRow[];
}

export interface RemediationPlannerOutcome {
  generatedAt: string;
  candidates: RemediationCandidate[];
  bySource: {
    security: number;
    releaseOps: number;
    coverageGap: number;
  };
}

// ---------------------------------------------------------------------------
// Risk mapping
// ---------------------------------------------------------------------------

function severityToRisk(sev: string): RemediationRisk {
  switch (sev) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":
    case "info":     return "low";
    default:          return "medium";
  }
}

function riskToPolicy(risk: RemediationRisk, isProduction = true): PolicyVerdict {
  if (risk === "critical") return "requires_two_approvers";
  if (risk === "high")     return isProduction ? "requires_two_approvers" : "requires_approval";
  if (risk === "medium")   return "requires_approval";
  return "allowed";
}

function policyToApproval(v: PolicyVerdict): ApprovalRequirement {
  if (v === "requires_two_approvers") return "two_approvers";
  if (v === "requires_approval")      return "single_approver";
  if (v === "blocked")                 return "policy_blocked";
  return "none";
}

// ---------------------------------------------------------------------------
// Security-scan ⇒ candidates
// ---------------------------------------------------------------------------

function changeTypeForSecurityCategory(category: SecurityCheckResult["category"]): ChangeType {
  switch (category) {
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
    default:                      return "configuration_change";
  }
}

function connectorForSecurity(check: SecurityCheckResult): string {
  if (check.provider) return `${check.provider}.${check.category}`;
  return `app.${check.category}`;
}

function rollbackForChangeType(change: ChangeType): RollbackRequirement {
  switch (change) {
    case "security_hardening":       return "rollback_terraform_revert";
    case "configuration_change":     return "rollback_terraform_revert";
    case "cost_optimization":        return "rollback_terraform_revert";
    case "reliability_improvement":  return "rollback_terraform_revert";
    case "pipeline_governance":      return "rollback_documented";
    case "desktop_review":           return "rollback_not_required";
    case "documentation_only":       return "rollback_not_required";
    case "manual_external_required": return "rollback_not_available";
  }
}

function verificationFor(change: ChangeType): VerificationRequirement {
  switch (change) {
    case "security_hardening":       return "rerun_security_check";
    case "configuration_change":     return "rescan_resource";
    case "cost_optimization":        return "post_deploy_smoke_test";
    case "reliability_improvement":  return "rollback_drill";
    case "pipeline_governance":      return "manual_review";
    case "desktop_review":           return "manual_review";
    case "documentation_only":       return "no_verification";
    case "manual_external_required": return "manual_review";
  }
}

function automationFor(change: ChangeType, risk: RemediationRisk): AutomationLevel {
  if (change === "manual_external_required") return "fully_manual";
  if (change === "documentation_only")        return "fully_manual";
  if (change === "desktop_review")            return "operator_assisted";
  if (risk === "critical" || risk === "high") return "approval_gated_assist";
  return "approval_gated_apply";
}

function desktopEligibilityFor(change: ChangeType, risk: RemediationRisk): DesktopEligibility {
  if (change === "pipeline_governance")      return "preview_only";
  if (change === "documentation_only")        return "not_eligible";
  if (change === "manual_external_required") return "not_eligible";
  if (risk === "critical")                    return "execution_disabled";
  return "eligible";
}

function fromSecurityCheck(check: SecurityCheckResult, tenantId?: string): RemediationCandidate | null {
  if (check.status === "pass") return null;
  const change = changeTypeForSecurityCategory(check.category);
  const risk = severityToRisk(check.severity);
  const policy = riskToPolicy(risk);
  const connector = connectorForSecurity(check);
  const id = candidateIdFor(check.id, connector);
  const now = new Date().toISOString();

  return {
    id,
    tenantId,
    sourceFindingId: check.id,
    provider: check.provider ?? (check.scope === "github" ? "github" : check.scope === "supply_chain" ? "github" : check.scope === "desktop" ? "desktop" : "platform"),
    connector,
    resourceIds: check.affectedResources ?? [],
    category: change,
    title: check.title,
    description: check.description,
    riskLevel: risk,
    impactSummary: check.description.slice(0, 240),
    proposedChange: {
      summary: check.remediation ?? "Tighten configuration per security guidance.",
      payload: { ruleCode: check.id, scope: check.scope },
    },
    changeType: change,
    automationLevel: automationFor(change, risk),
    sourceMode: check.source === "live" ? "live" : "preview",
    confidence: check.status === "fail" ? 0.8 : check.status === "warn" ? 0.6 : 0.4,
    evidence: check.evidence.slice(0, 8).map((e, i) => ({ label: `e${i + 1}`, ref: e })),
    requiredCapabilities: [
      { domain: (check.provider ?? "platform") as "aws" | "azure" | "gcp" | "platform", capability: "security_checks" },
      { domain: "platform", capability: "execution_plans" },
    ],
    requiredPermissions: change === "pipeline_governance" ? ["repo_admin"] : ["operator", "approver"],
    policyDecision: policy,
    approvalRequirement: policyToApproval(policy),
    rollbackRequirement: rollbackForChangeType(change),
    verificationRequirement: verificationFor(change),
    auditRequirement: "required",
    desktopReviewEligibility: desktopEligibilityFor(change, risk),
    status: check.status === "unknown" ? "needs_validation" : "ready_for_plan",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// ReleaseOps ⇒ candidates
// ---------------------------------------------------------------------------

function fromReleaseBlocker(blocker: ReadinessBlocker, tenantId?: string): RemediationCandidate {
  const risk = severityToRisk(blocker.severity);
  const policy = riskToPolicy(risk, true);
  const connector = `github.${blocker.kind}`;
  const id = candidateIdFor(blocker.id, connector);
  const now = new Date().toISOString();
  const change: ChangeType = "pipeline_governance";

  return {
    id,
    tenantId,
    sourceFindingId: blocker.id,
    provider: "github",
    connector,
    resourceIds: [blocker.repoId],
    category: change,
    title: blocker.title,
    description: blocker.detail,
    riskLevel: risk,
    impactSummary: blocker.detail.slice(0, 240),
    proposedChange: {
      summary: blocker.safeNextAction?.label ?? "Resolve release blocker per ReleaseOps recommendation.",
      payload: { repoId: blocker.repoId, kind: blocker.kind, branch: blocker.branch ?? "" },
    },
    changeType: change,
    automationLevel: "operator_assisted",
    sourceMode: "preview",
    confidence: 0.8,
    evidence: [
      { label: "repo",   ref: blocker.repoId },
      { label: "kind",   ref: blocker.kind },
      { label: "branch", ref: blocker.branch ?? "(default)" },
    ],
    requiredCapabilities: [
      { domain: "github", capability: "branch_protection" },
      { domain: "platform", capability: "execution_plans" },
    ],
    requiredPermissions: ["repo_admin"],
    policyDecision: policy,
    approvalRequirement: policyToApproval(policy),
    rollbackRequirement: "rollback_documented",
    verificationRequirement: "manual_review",
    auditRequirement: "required",
    desktopReviewEligibility: "preview_only",
    status: "ready_for_plan",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Coverage gap ⇒ candidates (engineering follow-ups, not customer fixes)
// ---------------------------------------------------------------------------

function fromCoverageGap(gap: CoverageGap, tenantId?: string): RemediationCandidate {
  const change: ChangeType = "documentation_only";
  const risk = gap.severity === "critical" ? "high" : gap.severity === "high" ? "medium" : "low";
  const policy: PolicyVerdict = "no_policy_match";
  const id = `rem.gap.${gap.coverageRef}`;
  const now = new Date().toISOString();

  return {
    id,
    tenantId,
    sourceFindingId: gap.id,
    provider: (gap.domain === "aws" || gap.domain === "azure" || gap.domain === "gcp") ? gap.domain : "platform",
    connector: `coverage.${gap.domain}`,
    resourceIds: [],
    category: change,
    title: gap.title,
    description: gap.selfServeExplanation,
    riskLevel: risk,
    impactSummary: gap.selfServeExplanation,
    proposedChange: {
      summary: gap.nextEngineeringTask ?? "Capability is preview/planned — no end-customer change required.",
      payload: { coverageRef: gap.coverageRef, severity: gap.severity },
    },
    changeType: change,
    automationLevel: "fully_manual",
    sourceMode: gap.sourceMode,
    confidence: 0.6,
    evidence: [{ label: "coverageRef", ref: gap.coverageRef }, { label: "impact", ref: gap.customerImpact }],
    requiredCapabilities: [{ domain: "platform", capability: gap.requiredCapability }],
    requiredPermissions: ["operator"],
    policyDecision: policy,
    approvalRequirement: "none",
    rollbackRequirement: "rollback_not_required",
    verificationRequirement: "no_verification",
    auditRequirement: "optional",
    desktopReviewEligibility: "not_eligible",
    status: "needs_validation",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public planner
// ---------------------------------------------------------------------------

export function planRemediations(input: RemediationPlannerInput = {}): RemediationPlannerOutcome {
  const candidates: RemediationCandidate[] = [];
  const tenantId = input.tenantId;

  if (input.securityScan) {
    for (const check of input.securityScan.results) {
      const cand = fromSecurityCheck(check, tenantId);
      if (cand) candidates.push(cand);
    }
  }

  if (input.releaseReadiness) {
    for (const blocker of input.releaseReadiness.blockers) {
      candidates.push(fromReleaseBlocker(blocker, tenantId));
    }
  }

  if (input.coverageGaps) {
    for (const gap of input.coverageGaps) {
      candidates.push(fromCoverageGap(gap, tenantId));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    candidates,
    bySource: {
      security:    input.securityScan?.results.filter((c) => c.status !== "pass").length ?? 0,
      releaseOps:  input.releaseReadiness?.blockers.length ?? 0,
      coverageGap: input.coverageGaps?.length ?? 0,
    },
  };
}

export function summariseCandidates(candidates: RemediationCandidate[]): {
  total: number;
  byCategory: Record<ChangeType, number>;
  byRisk: Record<RemediationRisk, number>;
  approvalGated: number;
  desktopEligible: number;
  blocked: number;
} {
  const byCategory: Record<ChangeType, number> = {
    configuration_change: 0, security_hardening: 0, cost_optimization: 0,
    reliability_improvement: 0, pipeline_governance: 0, desktop_review: 0,
    documentation_only: 0, manual_external_required: 0,
  };
  const byRisk: Record<RemediationRisk, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let approvalGated = 0, desktopEligible = 0, blockedCount = 0;

  for (const c of candidates) {
    byCategory[c.category] += 1;
    byRisk[c.riskLevel] += 1;
    if (c.approvalRequirement !== "none" && c.approvalRequirement !== "policy_blocked") approvalGated += 1;
    if (c.desktopReviewEligibility === "eligible") desktopEligible += 1;
    if (c.policyDecision === "blocked" || c.approvalRequirement === "policy_blocked") blockedCount += 1;
  }

  return {
    total: candidates.length,
    byCategory,
    byRisk,
    approvalGated,
    desktopEligible,
    blocked: blockedCount,
  };
}
