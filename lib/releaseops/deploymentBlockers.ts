/**
 * Deployment blocker engine.
 *
 * Converts release-state signals into a ranked list of typed blockers. Used
 * by:
 *  - the ReleaseOps page (renders each blocker with severity + safe action)
 *  - the copilot ("why is this release blocked?")
 *  - the policy engine (blockers above a severity threshold turn into
 *    require_approval / block decisions)
 *
 * Pure function over typed inputs — does no IO.
 */

import type {
  BranchProtection,
  EnvironmentName,
  Release,
  ServiceReadiness,
} from "./releaseModel";

// ---------------------------------------------------------------------------
// Blocker taxonomy
// ---------------------------------------------------------------------------

export type BlockerKind =
  | "branch_protection_weak"
  | "branch_protection_missing"
  | "required_checks_missing"
  | "signed_commits_missing"
  | "approval_pending"
  | "approval_count_insufficient"
  | "rollback_unverified"
  | "rollback_strategy_missing"
  | "readiness_score_low"
  | "readiness_dimension_weak"
  | "observability_weak"
  | "drift_detected"
  | "external_change_request_missing"
  | "external_change_request_pending"
  | "terraform_plan_outdated"
  | "production_outside_window"
  | "incident_open"
  | "dependency_conflict";

export type BlockerSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface DeploymentBlocker {
  id: string;
  kind: BlockerKind;
  severity: BlockerSeverity;
  /** One-line summary for cards / lists. */
  title: string;
  /** Long-form detail rendered in the blocker panel. */
  detail: string;
  /** Safe action the user can take. */
  safeNextAction?: { label: string; href: string };
  /** Stable evidence references — IDs of signals / records that justify the blocker. */
  evidence: string[];
  /** Whether the blocker can be cleared automatically once the underlying signal resolves. */
  autoClearable: boolean;
  /** When this blocker was first detected. */
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface BlockerInputs {
  release: Release;
  /** Branch protection rules on the release's repo. */
  branchProtections?: BranchProtection[];
  /** Composite readiness card for the service. */
  readiness?: ServiceReadiness;
  /** Whether a recent Terraform plan accompanies the release. */
  hasFreshTerraformPlan?: boolean;
  /** Whether drift was detected against the desired state. */
  driftDetected?: boolean;
  /** Whether an external change request (ServiceNow / Jira) is required + state. */
  externalChangeRequest?: { required: boolean; state: "open" | "approved" | "closed" | "missing" };
  /** Whether an incident is currently open against the service. */
  hasOpenIncident?: boolean;
  /** Currently within a deployment freeze window? */
  inFreezeWindow?: boolean;
  /** Cross-service dependency conflict detected. */
  dependencyConflict?: { with: string; reason: string };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const ENV_RANK: Record<EnvironmentName, number> = { development: 0, qa: 1, staging: 2, production: 3 };

let _seq = 0;
function newBlockerId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `blk_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

/**
 * Evaluate all blockers for a release. Returns the ranked list (most severe
 * first). Pure function.
 */
export function evaluateBlockers(input: BlockerInputs): DeploymentBlocker[] {
  const out: DeploymentBlocker[] = [];
  const now = new Date().toISOString();
  const envRank = ENV_RANK[input.release.environment];

  // 1. Branch protection
  if (input.release.environment === "production" && (!input.branchProtections || input.branchProtections.length === 0)) {
    out.push({
      id: newBlockerId(),
      kind: "branch_protection_missing",
      severity: "critical",
      title: "Production branch has no protection rules",
      detail: "The default branch on this repo has no branch protection. Production deploys without protection are not allowed.",
      safeNextAction: { label: "Open ReleaseOps governance", href: "/dashboard/releaseops" },
      evidence: [`repo:${input.release.repositoryId}`],
      autoClearable: true,
      detectedAt: now,
    });
  } else if (input.branchProtections && envRank >= ENV_RANK.staging) {
    const protectedMain = input.branchProtections.find((p) => p.branch === input.release.ref || p.branch === "main" || p.branch === "master");
    if (protectedMain) {
      if (protectedMain.requiredReviewers < 2 && input.release.environment === "production") {
        out.push({
          id: newBlockerId(),
          kind: "branch_protection_weak",
          severity: "high",
          title: "Production requires ≥2 reviewers",
          detail: `Branch ${protectedMain.branch} currently requires ${protectedMain.requiredReviewers} reviewer(s).`,
          safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
          evidence: [`branch_protection:${protectedMain.branch}`],
          autoClearable: true,
          detectedAt: now,
        });
      }
      if (!protectedMain.requireSignedCommits && input.release.environment === "production") {
        out.push({
          id: newBlockerId(),
          kind: "signed_commits_missing",
          severity: "medium",
          title: "Signed commits not required",
          detail: "Production branches should require signed commits to prevent unauthorized merges.",
          safeNextAction: { label: "View security model", href: "/docs/security-model" },
          evidence: [`branch_protection:${protectedMain.branch}`],
          autoClearable: true,
          detectedAt: now,
        });
      }
      if (protectedMain.requireStatusChecks.length === 0) {
        out.push({
          id: newBlockerId(),
          kind: "required_checks_missing",
          severity: "high",
          title: "No required status checks",
          detail: "The protected branch does not require any CI status checks to pass.",
          safeNextAction: { label: "View governance", href: "/dashboard/governance" },
          evidence: [`branch_protection:${protectedMain.branch}`],
          autoClearable: true,
          detectedAt: now,
        });
      }
    }
  }

  // 2. Approvals
  const requiredApprovals = input.release.approvals.filter((a) => a.required);
  const grantedApprovals = requiredApprovals.filter((a) => a.approvedAt);
  if (requiredApprovals.length > 0 && grantedApprovals.length < requiredApprovals.length) {
    out.push({
      id: newBlockerId(),
      kind: "approval_pending",
      severity: input.release.environment === "production" ? "high" : "medium",
      title: `${grantedApprovals.length}/${requiredApprovals.length} approvals granted`,
      detail: "Release is waiting on required approvals before it can proceed.",
      safeNextAction: { label: "Open approvals", href: "/dashboard/approvals" },
      evidence: requiredApprovals.map((a) => `approval:${a.id}`),
      autoClearable: true,
      detectedAt: now,
    });
  }

  // 3. Rollback
  if (!input.release.rollback || input.release.rollback.strategy === "none") {
    out.push({
      id: newBlockerId(),
      kind: "rollback_strategy_missing",
      severity: input.release.environment === "production" ? "critical" : "high",
      title: "No rollback strategy",
      detail: "Release has no defined rollback path. Production deploys without rollback are blocked.",
      safeNextAction: { label: "Review rollback strategy", href: "/docs/rollback" },
      evidence: [`release:${input.release.id}`],
      autoClearable: true,
      detectedAt: now,
    });
  } else if (!input.release.rollback.verified && input.release.environment === "production") {
    out.push({
      id: newBlockerId(),
      kind: "rollback_unverified",
      severity: "high",
      title: "Rollback path is unverified",
      detail: `Rollback strategy "${input.release.rollback.strategy}" has not been verified in a recent rehearsal.`,
      safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
      evidence: [`release:${input.release.id}`],
      autoClearable: false,
      detectedAt: now,
    });
  }

  // 4. Readiness score
  if (input.readiness && input.release.environment === "production") {
    if (input.readiness.compositeScore < 60) {
      out.push({
        id: newBlockerId(),
        kind: "readiness_score_low",
        severity: "critical",
        title: `Readiness score ${input.readiness.compositeScore}/100`,
        detail: "Composite readiness for this service is below the production gate (60).",
        safeNextAction: { label: "Open ReleaseOps readiness", href: "/dashboard/releaseops" },
        evidence: [`service:${input.readiness.serviceId}`],
        autoClearable: true,
        detectedAt: now,
      });
    } else if (input.readiness.compositeScore < 75) {
      // Surface weak individual dimensions for transparency
      for (const dim of input.readiness.dimensions) {
        if (dim.score < 0.5) {
          out.push({
            id: newBlockerId(),
            kind: "readiness_dimension_weak",
            severity: "medium",
            title: `Weak readiness: ${dim.label}`,
            detail: dim.detail,
            safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
            evidence: [`dimension:${dim.key}`, `service:${input.readiness.serviceId}`],
            autoClearable: true,
            detectedAt: now,
          });
        }
      }
    }
  }

  // 5. Drift
  if (input.driftDetected) {
    out.push({
      id: newBlockerId(),
      kind: "drift_detected",
      severity: input.release.environment === "production" ? "high" : "medium",
      title: "Infrastructure drift detected",
      detail: "The deployed environment has drifted from the desired Terraform state. Deploying on top of drift is unsafe.",
      safeNextAction: { label: "Open topology", href: "/dashboard/topology" },
      evidence: [`release:${input.release.id}`],
      autoClearable: true,
      detectedAt: now,
    });
  }

  // 6. Terraform plan freshness
  if (input.hasFreshTerraformPlan === false) {
    out.push({
      id: newBlockerId(),
      kind: "terraform_plan_outdated",
      severity: "medium",
      title: "Terraform plan is outdated",
      detail: "A fresh Terraform plan should accompany every release. Re-run plan against the target environment.",
      safeNextAction: { label: "View execution plans", href: "/dashboard/command-center" },
      evidence: [`release:${input.release.id}`],
      autoClearable: true,
      detectedAt: now,
    });
  }

  // 7. External change request
  if (input.externalChangeRequest?.required) {
    if (input.externalChangeRequest.state === "missing") {
      out.push({
        id: newBlockerId(),
        kind: "external_change_request_missing",
        severity: input.release.environment === "production" ? "critical" : "high",
        title: "External change request missing",
        detail: "Tenant policy requires an external CR (ServiceNow / Jira) before production deploys.",
        safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
        evidence: [`release:${input.release.id}`],
        autoClearable: true,
        detectedAt: now,
      });
    } else if (input.externalChangeRequest.state === "open") {
      out.push({
        id: newBlockerId(),
        kind: "external_change_request_pending",
        severity: "medium",
        title: "External change request pending",
        detail: "External CR is open but not yet approved. Release will start once approved.",
        evidence: [`release:${input.release.id}`],
        autoClearable: true,
        detectedAt: now,
      });
    }
  }

  // 8. Open incident
  if (input.hasOpenIncident) {
    out.push({
      id: newBlockerId(),
      kind: "incident_open",
      severity: "high",
      title: "Active incident on this service",
      detail: "An incident is currently open. Deploying during an active incident requires explicit override.",
      safeNextAction: { label: "View reliability", href: "/dashboard/reliability" },
      evidence: [`service:${input.release.service}`],
      autoClearable: true,
      detectedAt: now,
    });
  }

  // 9. Freeze window
  if (input.inFreezeWindow) {
    out.push({
      id: newBlockerId(),
      kind: "production_outside_window",
      severity: "high",
      title: "Inside deployment freeze window",
      detail: "Production deploys are paused. Out-of-window deploys require admin override.",
      safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
      evidence: [`release:${input.release.id}`],
      autoClearable: true,
      detectedAt: now,
    });
  }

  // 10. Dependency conflict
  if (input.dependencyConflict) {
    out.push({
      id: newBlockerId(),
      kind: "dependency_conflict",
      severity: "high",
      title: `Dependency conflict with ${input.dependencyConflict.with}`,
      detail: input.dependencyConflict.reason,
      safeNextAction: { label: "Open topology", href: "/dashboard/topology" },
      evidence: [`release:${input.release.id}`, `service:${input.dependencyConflict.with}`],
      autoClearable: false,
      detectedAt: now,
    });
  }

  // Sort by severity desc
  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

const RANK: Record<BlockerSeverity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Severity floor that should force a policy `block` decision. */
export function shouldBlockRelease(blockers: DeploymentBlocker[]): boolean {
  return blockers.some((b) => b.severity === "critical" || b.severity === "high");
}

/** Severity floor that should force `require_approval`. */
export function requiresApproval(blockers: DeploymentBlocker[]): boolean {
  return blockers.some((b) => b.severity === "medium" || b.severity === "high");
}

export const BLOCKER_KIND_LABEL: Record<BlockerKind, string> = {
  branch_protection_weak:           "Branch protection weak",
  branch_protection_missing:        "Branch protection missing",
  required_checks_missing:          "Required checks missing",
  signed_commits_missing:           "Signed commits missing",
  approval_pending:                 "Approval pending",
  approval_count_insufficient:      "Approval count insufficient",
  rollback_unverified:              "Rollback unverified",
  rollback_strategy_missing:        "Rollback strategy missing",
  readiness_score_low:              "Readiness score low",
  readiness_dimension_weak:         "Readiness dimension weak",
  observability_weak:               "Observability weak",
  drift_detected:                   "Drift detected",
  external_change_request_missing:  "Change request missing",
  external_change_request_pending:  "Change request pending",
  terraform_plan_outdated:          "Terraform plan outdated",
  production_outside_window:        "Freeze window",
  incident_open:                    "Incident open",
  dependency_conflict:              "Dependency conflict",
};
