/**
 * Execution Simulator.
 *
 * Applies a ChangeSet to a DigitalTwin *in memory only*. Produces a
 * simulated future twin + a typed SimulationResult that the UI, brain,
 * desktop, and approvals surfaces all read from.
 *
 * Hard rules:
 *  - Never invokes any provider SDK / CLI.
 *  - Never claims execution happened.
 *  - Destructive actions are flagged + require approval before status
 *    can advance.
 *  - Preview-mode twins yield `status: "preview_only"` regardless of how
 *    favourable the diff looks.
 */

import "server-only";

import type { DigitalTwin, DigitalTwinResource, DigitalTwinRiskLevel } from "@/lib/digitalTwin/digitalTwinModel";
import type { ChangeSet, ChangeAction } from "@/lib/simulation/changeSetModel";
import { changeSetMaxRisk, hasDestructiveAction } from "@/lib/simulation/changeSetModel";
import { diffChangeActions, type DiffBundle } from "@/lib/simulation/diffEngine";
import { analyzeChangeSetImpact, type ImpactReport, summarizeImpact } from "@/lib/simulation/impactAnalyzer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimulationStatus = "simulated" | "blocked" | "unsafe" | "incomplete" | "preview_only";

export type RiskDelta = "improved" | "unchanged" | "worsened" | "mixed" | "unknown";

export interface SimulationDelta {
  /** Direction the security posture would move. */
  security: RiskDelta;
  /** Direction the reliability posture would move. */
  reliability: RiskDelta;
  /** Cost delta — only set when telemetry exists. */
  cost: { delta: "savings" | "increase" | "neutral" | "unknown"; estMonthlyUsd?: number };
  /** Whether overall risk improved / worsened. */
  risk: RiskDelta;
}

export interface SimulationResult {
  id: string;
  changeSetId: string;
  twinId: string;
  status: SimulationStatus;
  summary: string;
  changes: ChangeAction[];
  diff: DiffBundle[];
  impact: ImpactReport;
  delta: SimulationDelta;
  /** Policy + governance blockers preventing this simulation from progressing. */
  blockers: { code: string; reason: string }[];
  approvalsRequired: { actionId: string; reason: string }[];
  rollbackFeasibility: "documented" | "uncertain" | "not_available";
  verificationPlan: { id: string; title: string }[];
  evidenceRefs: { label: string; ref: string }[];
  safeNextAction: { label: string; href?: string };
  /** 0..1 — confidence in the simulation as a whole. */
  confidence: number;
  generatedAt: string;
  /** The simulated future twin — same shape as input twin but with mutations applied. */
  simulatedTwin: DigitalTwin;
}

// ---------------------------------------------------------------------------
// Mutators (in-memory only)
// ---------------------------------------------------------------------------

function applyActionToResource(resource: DigitalTwinResource, action: ChangeAction): DigitalTwinResource {
  // Clone properties + apply after-values, keeping tags/state untouched.
  const properties: typeof resource.properties = { ...resource.properties };
  for (const [k, v] of Object.entries(action.after)) {
    if (v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      properties[k] = v;
    }
  }

  // Risk recomputation: restrict / enable / disable on a high-risk resource
  // typically improves the risk profile; expand / detach typically worsens.
  const riskLevel: DigitalTwinRiskLevel = (() => {
    if (action.actionType === "restrict" || action.actionType === "enable") {
      return downgradeRisk(resource.riskLevel);
    }
    if (action.actionType === "expand" || action.actionType === "disable" || action.actionType === "detach") {
      return upgradeRisk(resource.riskLevel);
    }
    return resource.riskLevel;
  })();

  return { ...resource, properties, riskLevel };
}

function downgradeRisk(r: DigitalTwinRiskLevel): DigitalTwinRiskLevel {
  switch (r) {
    case "critical": return "high";
    case "high":     return "medium";
    case "medium":   return "low";
    case "low":      return "low";
    case "unknown":  return "low";
  }
}
function upgradeRisk(r: DigitalTwinRiskLevel): DigitalTwinRiskLevel {
  switch (r) {
    case "low":      return "medium";
    case "medium":   return "high";
    case "high":     return "critical";
    case "critical": return "critical";
    case "unknown":  return "medium";
  }
}

function applyChangeSetToTwin(twin: DigitalTwin, changeSet: ChangeSet): DigitalTwin {
  const resources = twin.resources.map((r) => {
    const action = changeSet.proposedActions.find((a) => a.targetResourceId === r.id);
    if (!action) return r;
    if (action.actionType === "delete") {
      // Caller filters delete; we still tag resource as "deleting".
      return { ...r, state: "deleting" as DigitalTwinResource["state"] };
    }
    return applyActionToResource(r, action);
  }).filter((r) => !changeSet.removedResources.includes(r.id));

  // Created resources — synthetic placeholders, low confidence.
  const created: DigitalTwinResource[] = changeSet.addedResources.map((id) => ({
    id,
    provider: twin.provider === "multi" ? "aws" : twin.provider,
    type: "synthetic",
    name: id,
    properties: {},
    tags: { axiom_origin: "simulated" },
    state: "creating",
    riskLevel: "low",
    securityFindings: [],
    costFindings: [],
    dependencies: [],
    sourceMode: "preview",
    confidence: 0.3,
  }));

  return {
    ...twin,
    id: `${twin.id}.sim.${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    resources: [...resources, ...created],
    knownLimitations: [...twin.knownLimitations, "Simulated future twin — values are predictions, not observed state."],
  };
}

// ---------------------------------------------------------------------------
// Delta classification
// ---------------------------------------------------------------------------

function deltaFromDiffs(diffs: DiffBundle[]): SimulationDelta {
  let improved = 0, worsened = 0, unchanged = 0;
  for (const d of diffs) {
    if (d.riskDelta === "decreased") improved += 1;
    else if (d.riskDelta === "increased") worsened += 1;
    else if (d.riskDelta === "unchanged") unchanged += 1;
  }
  const riskClass = (i: number, w: number, u: number): RiskDelta => {
    if (i > 0 && w === 0) return "improved";
    if (w > 0 && i === 0) return "worsened";
    if (i > 0 && w > 0)   return "mixed";
    if (u > 0)            return "unchanged";
    return "unknown";
  };

  return {
    security: riskClass(improved, worsened, unchanged),
    reliability: "unknown",
    cost: { delta: "unknown" },
    risk: riskClass(improved, worsened, unchanged),
  };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export interface RunSimulationInput {
  twin: DigitalTwin;
  changeSet: ChangeSet;
  /** Operator-provided role list — used to flag missing approvals. */
  operatorRoles?: string[];
}

export function runSimulation(input: RunSimulationInput): SimulationResult {
  const { twin, changeSet } = input;
  const operatorRoles = input.operatorRoles ?? [];

  // Honest preview / blocked handling up-front.
  const blockers: SimulationResult["blockers"] = [];
  if (twin.sourceMode === "blocked") blockers.push({ code: "twin.blocked", reason: "Digital twin source is blocked." });
  if (changeSet.sourceMode === "blocked") blockers.push({ code: "changeset.blocked", reason: "ChangeSet source is blocked." });

  // Policy check via embedded approval requirements.
  const approvalsRequired: SimulationResult["approvalsRequired"] = [];
  for (const a of changeSet.proposedActions) {
    if (a.requiresApproval && !operatorRoles.includes("approver")) {
      approvalsRequired.push({ actionId: a.id, reason: "Action requires an approver role." });
    }
  }

  const destructive = hasDestructiveAction(changeSet);
  if (destructive) {
    approvalsRequired.push({ actionId: "changeset", reason: "ChangeSet contains a destructive action." });
  }

  const diff   = diffChangeActions(changeSet.proposedActions);
  const impact = analyzeChangeSetImpact(twin, changeSet);
  const summary = summarizeImpact(impact);

  const delta = deltaFromDiffs(diff);

  const simulatedTwin = applyChangeSetToTwin(twin, changeSet);

  const status: SimulationStatus = (() => {
    if (blockers.length > 0) return "blocked";
    if (changeSet.sourceMode !== "live") return "preview_only";
    if (twin.sourceMode !== "live")      return "preview_only";
    if (destructive && approvalsRequired.length > 0) return "unsafe";
    if (changeSet.proposedActions.length === 0)      return "incomplete";
    return "simulated";
  })();

  const summaryText =
    status === "blocked"      ? "Simulation blocked — see blockers."
    : status === "unsafe"     ? "Simulation contains destructive actions without approval."
    : status === "preview_only" ? `Preview-only simulation across ${summary.totalAffected} affected resource(s).`
    : status === "incomplete" ? "ChangeSet had no actions to simulate."
    : `Simulated · ${summary.totalAffected} resource(s) · max risk ${changeSetMaxRisk(changeSet)}.`;

  const safeNextAction: SimulationResult["safeNextAction"] = (() => {
    if (status === "blocked")         return { label: "Resolve blockers", href: "/dashboard/remediation" };
    if (status === "unsafe")          return { label: "Request approval",  href: "/dashboard/approvals" };
    if (status === "preview_only")    return { label: "Open in desktop preview", href: "/desktop/inbox" };
    if (status === "incomplete")      return { label: "Inspect changeset", href: "/dashboard/remediation" };
    return { label: "Review simulation", href: "/dashboard/simulations" };
  })();

  return {
    id: `sim.${changeSet.id}.${Date.now().toString(36)}`,
    changeSetId: changeSet.id,
    twinId: twin.id,
    status,
    summary: summaryText,
    changes: changeSet.proposedActions,
    diff,
    impact,
    delta,
    blockers,
    approvalsRequired,
    rollbackFeasibility: changeSet.rollbackPlanId ? "documented" : "uncertain",
    verificationPlan: changeSet.verificationChecklistId
      ? [{ id: changeSet.verificationChecklistId, title: "Verification checklist generated" }]
      : [],
    evidenceRefs: [
      { label: "twin",         ref: twin.id },
      { label: "changeSet",    ref: changeSet.id },
      { label: "actions",      ref: `${changeSet.proposedActions.length}` },
      { label: "affected",     ref: `${summary.totalAffected}` },
    ],
    safeNextAction,
    confidence: Math.min(twin.confidence, changeSet.confidence),
    generatedAt: new Date().toISOString(),
    simulatedTwin,
  };
}
