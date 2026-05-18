/**
 * Policy Evaluator.
 *
 * Pure-function decision against the canonical policy registry. Given
 * a PolicyEvaluationRequest, returns per-policy decisions + an
 * aggregate verdict. The evaluator never enables an action — it can
 * only block, require approval, or allow.
 *
 * Closed action union × deterministic decision = no surprise behavior.
 */

import "server-only";

import { POLICY_REGISTRY } from "./policyRegistry";
import type {
  PolicyDecision,
  PolicyDecisionKind,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  PolicyRecord,
  PolicyReport,
} from "./policyModel";

export function evaluatePolicies(req: PolicyEvaluationRequest): PolicyEvaluationResult {
  const decisions: PolicyDecision[] = [];

  for (const policy of POLICY_REGISTRY) {
    const decision = decideForPolicy(policy, req);
    if (decision) decisions.push(decision);
  }

  return {
    decisions,
    overallDecision: rollup(decisions.map((d) => d.decision)),
    safeNextAction: safeNextActionFor(req.action, decisions),
  };
}

export async function buildPolicyReport(): Promise<PolicyReport> {
  const total = POLICY_REGISTRY.length;
  const enforcedAlways     = POLICY_REGISTRY.filter((p) => p.enforcement === "enforced_always").length;
  const enforcedWithAudit  = POLICY_REGISTRY.filter((p) => p.enforcement === "enforced_with_audit").length;
  const advisory           = POLICY_REGISTRY.filter((p) => p.enforcement === "advisory").length;
  const disabled           = POLICY_REGISTRY.filter((p) => p.enforcement === "disabled").length;

  const byCategory = POLICY_REGISTRY.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    policies: POLICY_REGISTRY,
    summary: {
      total,
      enforcedAlways,
      enforcedWithAudit,
      advisory,
      disabled,
      byCategory: byCategory as PolicyReport["summary"]["byCategory"],
    },
    safetyContract: "policies_declared_no_action_taken",
    limitations: [
      "Policy registry is a declarative catalog. Enforcement happens in the underlying engines referenced by evidenceRef.",
      "Role-permission policy is advisory until full RBAC ships (Phase 3).",
    ],
    safeNextAction: { label: "Open Automation Boundaries", href: "/dashboard/automation-boundaries" },
  };
}

// ---------------------------------------------------------------------------
// Internal — per-policy decision logic
// ---------------------------------------------------------------------------

function decideForPolicy(policy: PolicyRecord, req: PolicyEvaluationRequest): PolicyDecision | null {
  // Mutation requests are hard-blocked
  if (req.action === "mutation_request") {
    if (policy.category === "read_only_enforcement" || policy.category === "no_mutation" || policy.category === "no_desktop_execution") {
      return {
        policyId: policy.id,
        decision: "blocked",
        reason: `${policy.title} — mutation requests are not reachable from any code path.`,
        sourceMode: req.sourceMode ?? "unknown",
        evidenceRefs: [policy.evidenceRef],
        limitations: [],
      };
    }
  }

  // Credential access requires the credential-safety policy
  if (req.action === "credential_access" && policy.category === "credential_safety") {
    return {
      policyId: policy.id,
      decision: "blocked",
      reason: `${policy.title} — raw credentials never leave their secure store.`,
      sourceMode: req.sourceMode ?? "unknown",
      evidenceRefs: [policy.evidenceRef],
      limitations: [],
    };
  }

  // Approval-required actions
  if (req.action === "approval_request_create" && policy.category === "approval_required") {
    return {
      policyId: policy.id,
      decision: "requires_approval",
      reason: `${policy.title} — operator decision required before downstream effects.`,
      sourceMode: req.sourceMode ?? "unknown",
      evidenceRefs: [policy.evidenceRef],
      limitations: [],
      safeNextAction: { label: "Open Approval queue", href: "/dashboard/approvals" },
    };
  }

  // Remediation plan + simulation are preview-only
  if ((req.action === "remediation_plan_build" || req.action === "simulation_create") &&
      (policy.category === "no_mutation" || policy.category === "read_only_enforcement")) {
    return {
      policyId: policy.id,
      decision: "preview_only",
      reason: `${policy.title} — generation produces text/twin output only, never real-world effects.`,
      sourceMode: req.sourceMode ?? "unknown",
      evidenceRefs: [policy.evidenceRef],
      limitations: [],
    };
  }

  // Evidence export tenant scope
  if (req.action === "evidence_export" && policy.category === "export_control") {
    return {
      policyId: policy.id,
      decision: "allowed",
      reason: `${policy.title} — export is tenant-scoped server-side.`,
      sourceMode: req.sourceMode ?? "unknown",
      evidenceRefs: [policy.evidenceRef],
      limitations: [],
    };
  }

  // Scheduled scans
  if (req.action === "scheduled_scan_run" && policy.category === "scheduled_scan_safety") {
    return {
      policyId: policy.id,
      decision: "allowed",
      reason: `${policy.title} — runner only invokes read-only adapters.`,
      sourceMode: req.sourceMode ?? "unknown",
      evidenceRefs: [policy.evidenceRef],
      limitations: [],
    };
  }

  return null;
}

function rollup(kinds: PolicyDecisionKind[]): PolicyDecisionKind {
  if (kinds.includes("blocked"))             return "blocked";
  if (kinds.includes("disabled"))            return "disabled";
  if (kinds.includes("missing_permission"))  return "missing_permission";
  if (kinds.includes("missing_evidence"))    return "missing_evidence";
  if (kinds.includes("requires_approval"))   return "requires_approval";
  if (kinds.includes("preview_only"))        return "preview_only";
  return "allowed";
}

function safeNextActionFor(
  action: PolicyEvaluationRequest["action"],
  decisions: PolicyDecision[],
): { label: string; href: string } {
  if (decisions.some((d) => d.decision === "blocked")) {
    return { label: "Open Automation Boundaries", href: "/dashboard/automation-boundaries" };
  }
  if (decisions.some((d) => d.decision === "requires_approval")) {
    return { label: "Open Approval queue", href: "/dashboard/approvals" };
  }
  if (action === "evidence_export") {
    return { label: "Open Trust Center", href: "/dashboard/trust" };
  }
  return { label: "Open Policies", href: "/dashboard/policies" };
}
