/**
 * Pre-flight Engine.
 *
 * Validates whether execution could safely proceed *later*. Preflight is
 * never real execution. It runs the typed checks the orchestration
 * relies on before moving to `dry_run_ready` / `execution_ready`.
 */

import type { OrchestrationStage } from "@/lib/execution/orchestrationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreflightCheckStatus = "passed" | "failed" | "warning" | "skipped" | "preview_only";

export interface PreflightCheck {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  detail: string;
}

export type PreflightOutcomeStatus = "passed" | "failed" | "warning" | "blocked" | "preview_only";

export interface PreflightInput {
  /** Honest source mode. */
  sourceMode: "live" | "preview" | "planned" | "blocked";
  /** Provider connection state. */
  providerConnected: boolean;
  /** Resource still exists in the latest snapshot. */
  resourceExists: boolean;
  /** Snapshot age in ms (lower = fresher). */
  snapshotAgeMs?: number;
  /** Max acceptable snapshot age (default 24h). */
  maxSnapshotAgeMs?: number;
  /** Required references present. */
  simulationPresent: boolean;
  policyPresent: boolean;
  approvalPresent: boolean;
  approvalStatus: "pending" | "approved" | "rejected" | "expired" | "cancelled" | "superseded";
  rollbackPresent: boolean;
  verificationPresent: boolean;
  auditWired: boolean;
  desktopHandoffValid?: boolean;
  /** Required permissions held by the operator. */
  hasRequiredPermissions: boolean;
  /** Feature mode allows the operation kind. */
  featureModeAllows: boolean;
  /** Plan has unknown destructive scope. */
  unknownDestructive: boolean;
  /** Plan is stale (e.g. simulation older than threshold). */
  stalePlan: boolean;
  /** Another workflow on the same resource is running. */
  conflictingWorkflowRunning: boolean;
}

export interface PreflightOutcome {
  status: PreflightOutcomeStatus;
  checks: PreflightCheck[];
  blockers: string[];
  warnings: string[];
  safeNextAction: { label: string; href?: string };
  evidenceRefs: { label: string; ref: string }[];
  /** Stage the orchestration may advance to after a pass. */
  unlockedStage?: OrchestrationStage;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function checkPassed(id: string, label: string, detail = "OK"): PreflightCheck {
  return { id, label, status: "passed", detail };
}
function checkFailed(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: "failed", detail };
}
function checkWarn(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: "warning", detail };
}
function checkPreview(id: string, label: string, detail: string): PreflightCheck {
  return { id, label, status: "preview_only", detail };
}

export function runPreflight(input: PreflightInput): PreflightOutcome {
  const maxAge = input.maxSnapshotAgeMs ?? 24 * 60 * 60 * 1000;
  const checks: PreflightCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Provider connection.
  if (input.providerConnected) checks.push(checkPassed("preflight.provider", "Provider connected"));
  else { checks.push(checkFailed("preflight.provider", "Provider connection", "Provider is not connected.")); blockers.push("Provider not connected."); }

  // 2. Resource exists.
  if (input.resourceExists) checks.push(checkPassed("preflight.resource", "Resource exists in snapshot"));
  else { checks.push(checkFailed("preflight.resource", "Resource exists", "Target resource missing from latest snapshot.")); blockers.push("Resource missing."); }

  // 3. Snapshot freshness.
  if (typeof input.snapshotAgeMs === "number") {
    if (input.snapshotAgeMs <= maxAge) checks.push(checkPassed("preflight.snapshot", "Snapshot fresh", `${Math.round(input.snapshotAgeMs / 60000)} min old`));
    else { checks.push(checkWarn("preflight.snapshot", "Snapshot stale", `${Math.round(input.snapshotAgeMs / 60000)} min old`)); warnings.push("Snapshot is stale — refresh recommended."); }
  } else {
    checks.push(checkWarn("preflight.snapshot", "Snapshot age unknown", "No age recorded — refresh recommended."));
    warnings.push("Snapshot age unknown.");
  }

  // 4. Simulation present.
  if (input.simulationPresent) checks.push(checkPassed("preflight.simulation", "Simulation present"));
  else { checks.push(checkFailed("preflight.simulation", "Simulation present", "Simulation must exist before preflight.")); blockers.push("Simulation missing."); }

  // 5. Policy decision present.
  if (input.policyPresent) checks.push(checkPassed("preflight.policy", "Policy decision present"));
  else { checks.push(checkFailed("preflight.policy", "Policy decision", "Policy decision must be recorded.")); blockers.push("Policy decision missing."); }

  // 6. Approval valid.
  if (input.approvalPresent && input.approvalStatus === "approved") checks.push(checkPassed("preflight.approval", "Approval valid"));
  else if (input.approvalPresent && input.approvalStatus === "pending")
    { checks.push(checkWarn("preflight.approval", "Approval pending", "Waiting for approval.")); warnings.push("Approval pending."); }
  else if (input.approvalPresent && (input.approvalStatus === "rejected" || input.approvalStatus === "expired"))
    { checks.push(checkFailed("preflight.approval", "Approval invalid", `Approval status: ${input.approvalStatus}.`)); blockers.push(`Approval ${input.approvalStatus}.`); }
  else
    { checks.push(checkFailed("preflight.approval", "Approval missing", "No approval recorded for this orchestration.")); blockers.push("Approval missing."); }

  // 7. Rollback present.
  if (input.rollbackPresent) checks.push(checkPassed("preflight.rollback", "Rollback plan present"));
  else { checks.push(checkFailed("preflight.rollback", "Rollback plan", "No rollback plan documented.")); blockers.push("Rollback plan missing."); }

  // 8. Verification present.
  if (input.verificationPresent) checks.push(checkPassed("preflight.verification", "Verification plan present"));
  else { checks.push(checkFailed("preflight.verification", "Verification plan", "No verification checklist.")); blockers.push("Verification plan missing."); }

  // 9. Audit wired.
  if (input.auditWired) checks.push(checkPassed("preflight.audit", "Audit pipeline wired"));
  else { checks.push(checkFailed("preflight.audit", "Audit pipeline", "Audit pipeline not wired.")); blockers.push("Audit pipeline not wired."); }

  // 10. Desktop handoff (optional).
  if (input.desktopHandoffValid !== undefined) {
    if (input.desktopHandoffValid) checks.push(checkPassed("preflight.desktop", "Desktop handoff valid"));
    else { checks.push(checkFailed("preflight.desktop", "Desktop handoff", "Desktop handoff invalid / expired.")); blockers.push("Desktop handoff invalid."); }
  }

  // 11. Permissions.
  if (input.hasRequiredPermissions) checks.push(checkPassed("preflight.permissions", "Required permissions held"));
  else { checks.push(checkFailed("preflight.permissions", "Permissions", "Operator lacks required permissions.")); blockers.push("Operator lacks permissions."); }

  // 12. Feature mode allows.
  if (input.featureModeAllows) checks.push(checkPassed("preflight.feature_mode", "Feature mode allows operation"));
  else { checks.push(checkFailed("preflight.feature_mode", "Feature mode", "Feature mode blocks operation.")); blockers.push("Feature mode blocks operation."); }

  // 13. Destructive unknown.
  if (!input.unknownDestructive) checks.push(checkPassed("preflight.destructive", "No unknown destructive scope"));
  else { checks.push(checkFailed("preflight.destructive", "Destructive scope", "ChangeSet has unknown destructive scope.")); blockers.push("Destructive scope unknown."); }

  // 14. Stale plan.
  if (!input.stalePlan) checks.push(checkPassed("preflight.plan_fresh", "Plan fresh enough"));
  else { checks.push(checkWarn("preflight.plan_fresh", "Plan stale", "Plan / simulation has aged past freshness window.")); warnings.push("Plan stale — regenerate before execution."); }

  // 15. Conflicting workflow.
  if (!input.conflictingWorkflowRunning) checks.push(checkPassed("preflight.no_conflict", "No conflicting workflow"));
  else { checks.push(checkFailed("preflight.no_conflict", "Conflict", "Another workflow is running on the same resource.")); blockers.push("Conflicting workflow running."); }

  // Source-mode gate — preview never passes preflight for execution.
  if (input.sourceMode !== "live") {
    // Down-grade all the otherwise-passed checks to preview_only.
    for (const c of checks) if (c.status === "passed") c.status = "preview_only";
  }

  const failingChecks = checks.filter((c) => c.status === "failed");
  const previewOnly   = input.sourceMode !== "live";

  let status: PreflightOutcomeStatus;
  if (previewOnly && failingChecks.length === 0) status = "preview_only";
  else if (failingChecks.length > 0) status = "failed";
  else if (warnings.length > 0)      status = "warning";
  else                                 status = "passed";

  const safeNextAction: PreflightOutcome["safeNextAction"] = (() => {
    if (status === "failed") return { label: "Resolve preflight blockers", href: "/dashboard/orchestration" };
    if (status === "warning") return { label: "Re-run preflight after addressing warnings" };
    if (status === "preview_only") return { label: "Open desktop preview", href: "/desktop/inbox" };
    return { label: "Advance to dry-run", href: "/dashboard/orchestration" };
  })();

  return {
    status,
    checks,
    blockers,
    warnings,
    safeNextAction,
    evidenceRefs: [
      { label: "checks",   ref: `${checks.length}` },
      { label: "blockers", ref: `${blockers.length}` },
      { label: "warnings", ref: `${warnings.length}` },
    ],
    unlockedStage: status === "passed" ? "dry_run_ready" : undefined,
    generatedAt: new Date().toISOString(),
  };
}
