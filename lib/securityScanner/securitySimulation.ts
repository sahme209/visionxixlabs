/**
 * Security Remediation Simulation.
 *
 * Predicts the security posture delta for a remediation. For each finding
 * that the simulation resolves, the score increases and the finding is
 * counted as `pass`. Migration / rollback caveats are surfaced honestly
 * — the simulation never claims a fix is complete.
 */

import type {
  SecurityScanOutcome,
  SecurityCheckResult,
  SecurityCheckSeverity,
} from "@/lib/securityScanner/securityScanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityFindingDelta {
  findingId: string;
  before: { status: SecurityCheckResult["status"]; severity: SecurityCheckSeverity };
  after:  { status: SecurityCheckResult["status"]; severity: SecurityCheckSeverity };
  /** Plain-language risk delta. */
  riskDelta: "improved" | "unchanged" | "worsened";
  /** Caveats — migration, rollback, manual review. */
  caveats: string[];
}

export interface SecuritySimulationResult {
  before: { score: number; failing: number; warning: number };
  after:  { score: number; failing: number; warning: number };
  resolved: SecurityFindingDelta[];
  unresolved: SecurityFindingDelta[];
  /** Findings whose simulation could not be predicted. */
  unknown: string[];
  /** Verification steps the operator must run after applying. */
  verificationPlan: string[];
  /** Rollback complexity per resolved finding. */
  rollbackNotes: { findingId: string; note: string }[];
  sourceMode: "live" | "preview";
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Score model — kept compatible with `summary.score` from securityScanner
// ---------------------------------------------------------------------------

function scoreFromResults(results: SecurityCheckResult[]): { score: number; failing: number; warning: number } {
  const total = results.length || 1;
  const pass    = results.filter((r) => r.status === "pass").length;
  const failing = results.filter((r) => r.status === "fail").length;
  const warning = results.filter((r) => r.status === "warn").length;
  const score = Math.round(((pass * 1.0 + warning * 0.5) / total) * 100);
  return { score, failing, warning };
}

// ---------------------------------------------------------------------------
// Caveats per category
// ---------------------------------------------------------------------------

function caveatsFor(check: SecurityCheckResult): string[] {
  const out: string[] = [];
  switch (check.category) {
    case "encryption_at_rest":
      out.push("Existing unencrypted objects are not retroactively encrypted — schedule a copy-in-place job to upgrade if required.");
      out.push("Confirm KMS key access is granted to all legitimate readers / writers.");
      break;
    case "network_exposure":
      out.push("Confirm no legitimate consumer is on the public path before tightening.");
      out.push("If the change is reverted, re-apply the prior security-group rule from VCS history.");
      break;
    case "iam_overreach":
      out.push("Run an IAM trust evaluator re-grade after policy update.");
      out.push("Confirm any cross-account principals still have necessary access.");
      break;
    case "secret_handling":
      out.push("Rotate any credential implicated by the original finding.");
      break;
    case "supply_chain":
      out.push("Re-run dependency scan to confirm the advisory is closed.");
      break;
    case "backup_resilience":
      out.push("Run a rollback drill to confirm the new backup is restorable.");
      break;
    case "single_region":
      out.push("Confirm cost + latency tradeoffs are acceptable in the target tier.");
      break;
    default:
      break;
  }
  return out;
}

function rollbackNoteFor(check: SecurityCheckResult): string {
  if (check.category === "encryption_at_rest") return "Disable bucket encryption — existing keys may persist on prior objects.";
  if (check.category === "network_exposure")   return "Re-add the previous wide-open ingress rule if required.";
  if (check.category === "iam_overreach")      return "Restore prior trust policy from VCS history.";
  if (check.category === "secret_handling")    return "Re-issue the rotated secret to dependent systems.";
  return "Revert the underlying change per the rollback plan.";
}

// ---------------------------------------------------------------------------
// Public simulator
// ---------------------------------------------------------------------------

export interface SimulateSecurityInput {
  current: SecurityScanOutcome;
  /** Finding ids the simulation should treat as resolved. */
  resolveFindingIds: string[];
}

export function simulateSecurityRemediation(input: SimulateSecurityInput): SecuritySimulationResult {
  const resolveSet = new Set(input.resolveFindingIds);

  const before = scoreFromResults(input.current.results);

  const afterResults: SecurityCheckResult[] = input.current.results.map((r) => {
    if (!resolveSet.has(r.id)) return r;
    // Simulated future state — finding flips to pass.
    return { ...r, status: "pass" };
  });

  const after = scoreFromResults(afterResults);

  const resolved: SecurityFindingDelta[] = [];
  const unresolved: SecurityFindingDelta[] = [];
  const unknown: string[] = [];
  const verificationPlan: string[] = [];
  const rollbackNotes: SecuritySimulationResult["rollbackNotes"] = [];

  for (const id of resolveSet) {
    const check = input.current.results.find((r) => r.id === id);
    if (!check) {
      unknown.push(id);
      continue;
    }
    if (check.status === "unknown" || check.status === "preview") {
      unknown.push(id);
      continue;
    }
    resolved.push({
      findingId: id,
      before: { status: check.status, severity: check.severity },
      after:  { status: "pass",       severity: check.severity },
      riskDelta: "improved",
      caveats: caveatsFor(check),
    });
    verificationPlan.push(`Re-run ${check.category} check for ${check.id} and confirm status flips to pass.`);
    rollbackNotes.push({ findingId: id, note: rollbackNoteFor(check) });
  }

  for (const r of input.current.results) {
    if (resolveSet.has(r.id)) continue;
    if (r.status === "pass") continue;
    unresolved.push({
      findingId: r.id,
      before: { status: r.status, severity: r.severity },
      after:  { status: r.status, severity: r.severity },
      riskDelta: "unchanged",
      caveats: ["This finding is not part of the simulated remediation scope."],
    });
  }

  return {
    before,
    after,
    resolved,
    unresolved,
    unknown,
    verificationPlan,
    rollbackNotes,
    sourceMode: "preview",
    generatedAt: new Date().toISOString(),
  };
}
