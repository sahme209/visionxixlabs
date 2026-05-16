/**
 * Security Reasoner.
 *
 * The scanner produces typed `SecurityCheckResult` rows. This module
 * reasons across them — composing risk narratives, ordering by impact,
 * pointing the operator at the precise remediation, and emitting the
 * audit + validation requirements that come with the recommended fix.
 *
 * No fake CVE claims. Every reasoning row points back to the underlying
 * check result by id.
 */

import type {
  SecurityCheckResult,
  SecurityCheckSeverity,
  SecurityScanOutcome,
} from "@/lib/securityScanner/securityScanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskNarrativeStatus = "pass" | "fail" | "warning" | "unknown" | "preview" | "blocked";

export interface SecurityRiskNarrative {
  /** Stable reference back to the underlying check. */
  checkId: string;
  title: string;
  status: RiskNarrativeStatus;
  severity: SecurityCheckSeverity;
  /** Plain-language narrative of *why* this is risky right now. */
  narrative: string;
  affectedSystems: string[];
  evidence: string[];
  /** Recommended fix in operator language. */
  recommendedFix?: string;
  /** Should this fix be wrapped in a plan candidate? */
  executionPlanCandidate: boolean;
  /** Policy gate triggered by the fix, if any. */
  policyRequirement?: string;
  /** Audit requirement once fix lands. */
  auditRequirement?: string;
  /** Post-fix validation. */
  validationCheck?: string;
  /** False-positive guard for the operator. */
  falsePositiveNote?: string;
}

export interface SecurityReasoningSummary {
  totalNarratives: number;
  bySeverity: Record<SecurityCheckSeverity, number>;
  topRisks: SecurityRiskNarrative[];
  pipelineRiskCount: number;
  cloudRiskCount: number;
  supplyChainRiskCount: number;
  desktopRiskCount: number;
}

export interface SecurityReasoningOutcome {
  generatedAt: string;
  narratives: SecurityRiskNarrative[];
  summary: SecurityReasoningSummary;
  /** Single recommended next operator action. */
  safeNextAction: { label: string; checkId?: string; href?: string };
}

// ---------------------------------------------------------------------------
// Reasoner
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<SecurityCheckSeverity, number> = {
  info: 0, low: 1, medium: 2, high: 3, critical: 4,
};

function mapStatus(status: SecurityCheckResult["status"]): RiskNarrativeStatus {
  switch (status) {
    case "pass":    return "pass";
    case "fail":    return "fail";
    case "warn":    return "warning";
    case "unknown": return "unknown";
    case "preview": return "preview";
    default:        return "unknown";
  }
}

function shouldOpenPlan(check: SecurityCheckResult): boolean {
  if (check.status !== "fail") return false;
  // Cloud + supply-chain fails are great plan candidates; app + desktop
  // fails usually require config or signing changes outside of cloud
  // execution plans.
  return check.scope === "cloud" || check.scope === "supply_chain";
}

function defaultPolicyRequirement(check: SecurityCheckResult): string | undefined {
  if (check.severity === "critical" || check.severity === "high") {
    return "Two-operator approval (separation of duties).";
  }
  if (check.severity === "medium") {
    return "Standard approval policy.";
  }
  return undefined;
}

function defaultAuditRequirement(check: SecurityCheckResult): string | undefined {
  if (check.status !== "fail") return undefined;
  return "Apply must emit redacted audit event with linked finding id and approver chain.";
}

function defaultValidationCheck(check: SecurityCheckResult): string | undefined {
  switch (check.category) {
    case "iam_overreach":         return "Re-run IAM trust evaluator and confirm grade improvement.";
    case "network_exposure":      return "Re-scan resource and confirm public flag is false.";
    case "encryption_at_rest":    return "Confirm bucket/volume reports encryption-at-rest enabled.";
    case "secret_handling":       return "Rotate credential and confirm secret-scan is clean.";
    case "supply_chain":          return "Re-run dependency scan and confirm advisory is closed.";
    case "audit_gap":             return "Re-verify audit pipeline is wired and emits events.";
    case "backup_resilience":     return "Confirm backups + cross-region replication on the resource.";
    case "single_region":         return "Confirm multi-region/redundancy posture on the resource.";
    case "cloud_misconfig":       return "Re-run the cloud scan and confirm misconfig is resolved.";
    case "app_boundary":          return "Confirm app boundary control is enforced server-side.";
    case "desktop_distribution":  return "Confirm desktop binary signing/notarization is enabled.";
    case "desktop_execution":     return "Confirm desktop local apply is blocked per policy.";
    default:                      return "Re-run the failing check and confirm status flips to pass.";
  }
}

function defaultFalsePositiveNote(check: SecurityCheckResult): string | undefined {
  if (check.status === "preview") {
    return "Preview check — review evidence before treating as a confirmed risk.";
  }
  if (check.severity === "info" || check.severity === "low") {
    return "Often acceptable in development environments. Confirm scope before remediation.";
  }
  return undefined;
}

function composeNarrative(check: SecurityCheckResult): string {
  const scopeText = {
    cloud:        "cloud posture",
    app:          "application posture",
    supply_chain: "supply chain posture",
    desktop:      "desktop posture",
    github:       "GitHub / ReleaseOps posture",
  }[check.scope];

  if (check.status === "pass") {
    return `${check.title} — ${scopeText} check passes against current evidence.`;
  }
  if (check.status === "preview") {
    return `${check.title} — preview signal in ${scopeText}. Live data follows when provider/credentials are configured.`;
  }
  if (check.status === "unknown") {
    return `${check.title} — ${scopeText} check could not produce a confident verdict. Re-run with broader scope.`;
  }
  if (check.status === "warn") {
    return `${check.title} — borderline ${scopeText} signal. Tighten before it becomes a critical finding.`;
  }
  return `${check.title} — ${scopeText} risk: ${check.description}`;
}

export function reasonAboutSecurityScan(outcome: SecurityScanOutcome): SecurityReasoningOutcome {
  const narratives: SecurityRiskNarrative[] = outcome.results.map((check) => ({
    checkId: check.id,
    title: check.title,
    status: mapStatus(check.status),
    severity: check.severity,
    narrative: composeNarrative(check),
    affectedSystems: check.affectedResources ?? [],
    evidence: check.evidence,
    recommendedFix: check.remediation,
    executionPlanCandidate: shouldOpenPlan(check),
    policyRequirement:  defaultPolicyRequirement(check),
    auditRequirement:   defaultAuditRequirement(check),
    validationCheck:    defaultValidationCheck(check),
    falsePositiveNote:  defaultFalsePositiveNote(check),
  }));

  // Order by severity desc, then by status (fail > warn > preview > unknown > pass)
  const statusRank: Record<RiskNarrativeStatus, number> = {
    fail: 4, warning: 3, preview: 2, unknown: 1, blocked: 1, pass: 0,
  };
  narratives.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    return statusRank[b.status] - statusRank[a.status];
  });

  const bySeverity: Record<SecurityCheckSeverity, number> = {
    info: 0, low: 0, medium: 0, high: 0, critical: 0,
  };
  for (const n of narratives) bySeverity[n.severity] += 1;

  const scopeOf = (id: string) => outcome.results.find((r) => r.id === id)?.scope;
  const cloudRiskCount       = narratives.filter((n) => n.status === "fail" && scopeOf(n.checkId) === "cloud").length;
  const pipelineRiskCount    = narratives.filter((n) => n.status === "fail" && scopeOf(n.checkId) === "supply_chain").length;
  const supplyChainRiskCount = pipelineRiskCount;
  const desktopRiskCount     = narratives.filter((n) => n.status === "fail" && scopeOf(n.checkId) === "desktop").length;

  const topRisks = narratives.filter((n) => n.status === "fail" || n.status === "warning").slice(0, 5);

  const top = topRisks[0];
  const safeNextAction = top
    ? {
        label:  top.executionPlanCandidate
          ? `Open plan for: ${top.title}`
          : `Review: ${top.title}`,
        checkId: top.checkId,
        href: "/dashboard/security-scanner",
      }
    : { label: "Open security scanner", href: "/dashboard/security-scanner" };

  return {
    generatedAt: new Date().toISOString(),
    narratives,
    summary: {
      totalNarratives: narratives.length,
      bySeverity,
      topRisks,
      pipelineRiskCount,
      cloudRiskCount,
      supplyChainRiskCount,
      desktopRiskCount,
    },
    safeNextAction,
  };
}
