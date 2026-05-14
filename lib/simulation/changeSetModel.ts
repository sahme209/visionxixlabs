/**
 * ChangeSet Model.
 *
 * A ChangeSet bundles a remediation candidate + its previews into a
 * concrete, typed "what would change" document the simulator applies
 * against the digital twin. Destructive actions are explicitly flagged
 * — the simulator + UI must never quietly run a delete.
 */

import type { DigitalTwinResource, DigitalTwinRiskLevel } from "@/lib/digitalTwin/digitalTwinModel";
import type {
  RemediationCandidate,
  ApprovalRequirement,
  PolicyVerdict,
} from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type ChangeActionType =
  | "create"
  | "update"
  | "delete"
  | "attach"
  | "detach"
  | "enable"
  | "disable"
  | "restrict"
  | "expand"
  | "review_only";

export interface ChangeAction {
  id: string;
  actionType: ChangeActionType;
  targetResourceId: string;
  /** Pre-change snapshot of the target's relevant fields. */
  before: Record<string, string | number | boolean | null>;
  /** Proposed post-change snapshot. */
  after: Record<string, string | number | boolean | null>;
  riskLevel: DigitalTwinRiskLevel;
  reversible: boolean;
  requiresApproval: boolean;
  evidence: { label: string; ref: string }[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// ChangeSet
// ---------------------------------------------------------------------------

export interface ChangeSet {
  id: string;
  tenantId?: string;
  sourceRemediationId: string;
  sourceExecutionPlanId?: string;
  provider: RemediationCandidate["provider"];
  changeType: RemediationCandidate["changeType"];
  title: string;
  description: string;

  proposedActions: ChangeAction[];
  /** Resource ids the changeset touches in any way. */
  affectedResources: string[];
  /** Subsets — `delete` actions are first-class so the simulator can guard. */
  addedResources: string[];
  modifiedResources: string[];
  removedResources: string[];

  policyDecisions: PolicyVerdict[];
  approvalRequirements: ApprovalRequirement[];

  rollbackPlanId?: string;
  verificationChecklistId?: string;
  terraformPreviewId?: string;
  cliPreviewId?: string;

  sourceMode: "live" | "preview" | "planned" | "blocked";
  confidence: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

const ACTION_HAZARD: Record<ChangeActionType, DigitalTwinRiskLevel> = {
  create: "low",
  update: "medium",
  delete: "critical",
  attach: "medium",
  detach: "high",
  enable: "low",
  disable: "high",
  restrict: "medium",
  expand: "high",
  review_only: "low",
};

export function actionHazard(action: ChangeActionType): DigitalTwinRiskLevel {
  return ACTION_HAZARD[action];
}

export function newChangeAction(input: {
  id?: string;
  actionType: ChangeActionType;
  targetResourceId: string;
  before: ChangeAction["before"];
  after: ChangeAction["after"];
  riskLevel?: DigitalTwinRiskLevel;
  reversible?: boolean;
  requiresApproval?: boolean;
  evidence?: ChangeAction["evidence"];
  notes?: string[];
}): ChangeAction {
  return {
    id: input.id ?? `act.${input.actionType}.${input.targetResourceId}`,
    actionType: input.actionType,
    targetResourceId: input.targetResourceId,
    before: input.before,
    after: input.after,
    riskLevel: input.riskLevel ?? ACTION_HAZARD[input.actionType],
    reversible: input.reversible ?? (input.actionType !== "delete"),
    requiresApproval: input.requiresApproval ?? (ACTION_HAZARD[input.actionType] === "high" || ACTION_HAZARD[input.actionType] === "critical"),
    evidence: input.evidence ?? [],
    notes: input.notes ?? [],
  };
}

// ---------------------------------------------------------------------------
// Hazard helpers
// ---------------------------------------------------------------------------

export function destructiveActions(changeSet: ChangeSet): ChangeAction[] {
  return changeSet.proposedActions.filter((a) => a.actionType === "delete" || (a.actionType === "disable" && a.riskLevel === "critical"));
}

export function hasDestructiveAction(changeSet: ChangeSet): boolean {
  return destructiveActions(changeSet).length > 0;
}

/** Returns the highest-risk action class in a ChangeSet (or "low" if empty). */
export function changeSetMaxRisk(changeSet: ChangeSet): DigitalTwinRiskLevel {
  const ranks: Record<DigitalTwinRiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
  let max: DigitalTwinRiskLevel = "low";
  for (const a of changeSet.proposedActions) {
    if (ranks[a.riskLevel] > ranks[max]) max = a.riskLevel;
  }
  return max;
}

/**
 * Compose a ChangeSet from a remediation candidate. The simulator can
 * later replace the synthetic before/after blocks with twin-derived data.
 */
export function changeSetFromCandidate(candidate: RemediationCandidate, targetResource?: DigitalTwinResource): ChangeSet {
  const targetId = targetResource?.id ?? candidate.resourceIds[0] ?? "(unspecified)";
  const before: ChangeAction["before"] = targetResource
    ? flatten(targetResource.properties)
    : {};
  const after: ChangeAction["after"] = { ...before, axiomRemediation: candidate.connector };

  const actionType: ChangeActionType =
    candidate.category === "security_hardening"   ? "restrict" :
    candidate.category === "configuration_change" ? "update"   :
    candidate.category === "cost_optimization"    ? "update"   :
    candidate.category === "reliability_improvement" ? "enable" :
    candidate.category === "pipeline_governance"  ? "enable"   :
    candidate.category === "desktop_review"       ? "review_only" :
    candidate.category === "documentation_only"   ? "review_only" :
                                                     "review_only";

  const action = newChangeAction({
    actionType,
    targetResourceId: targetId,
    before,
    after,
    riskLevel: candidate.riskLevel as DigitalTwinRiskLevel,
    reversible: candidate.rollbackRequirement !== "rollback_not_available",
    requiresApproval: candidate.approvalRequirement !== "none",
    evidence: candidate.evidence.map((e) => ({ label: e.label, ref: e.ref })),
    notes: [candidate.impactSummary].filter(Boolean),
  });

  return {
    id: `cs.${candidate.id}`,
    tenantId: candidate.tenantId,
    sourceRemediationId: candidate.id,
    sourceExecutionPlanId: undefined,
    provider: candidate.provider,
    changeType: candidate.changeType,
    title: candidate.title,
    description: candidate.description,
    proposedActions: [action],
    affectedResources: [targetId],
    addedResources: actionType === "create" ? [targetId] : [],
    modifiedResources: actionType === "update" || actionType === "restrict" || actionType === "enable" || actionType === "disable" ? [targetId] : [],
    removedResources: actionType === "delete" ? [targetId] : [],
    policyDecisions: [candidate.policyDecision],
    approvalRequirements: [candidate.approvalRequirement],
    rollbackPlanId: `rb.${candidate.id}`,
    verificationChecklistId: `vc.${candidate.id}`,
    terraformPreviewId: `tf.${candidate.id}`,
    cliPreviewId: `cli.${candidate.id}`,
    sourceMode: candidate.sourceMode,
    confidence: candidate.confidence,
    createdAt: new Date().toISOString(),
  };
}

function flatten(props: Record<string, string | number | boolean>): ChangeAction["before"] {
  const out: ChangeAction["before"] = {};
  for (const [k, v] of Object.entries(props)) out[k] = v;
  return out;
}
