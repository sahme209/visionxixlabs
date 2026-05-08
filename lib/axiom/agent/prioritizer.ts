import type { ExecutionPlanItem, ActionType } from "../executionPlan";
import type { ConfidenceScore } from "../costSignals";
import type {
  ActionDisposition,
  AgentFinding,
  AgentRecommendation,
  FindingSeverity,
  FindingCategory,
} from "./types";
import type { OrgPreferences } from "./preferences";
import {
  applyDispositionPolicy,
  applyRiskTolerance,
  categoryBoost,
} from "./preferences";

// ---------------------------------------------------------------------------
// Disposition classification — determines how the agent handles each action
// ---------------------------------------------------------------------------

export function classifyDisposition(
  item: ExecutionPlanItem,
  confidence: ConfidenceScore,
): { disposition: ActionDisposition; reason: string } {
  if (item.actionType === "decommission_compute") {
    return { disposition: "report_only", reason: "Instance deletion is irreversible — requires manual execution with snapshot verification." };
  }

  if (item.actionType === "purchase_commitment") {
    return { disposition: "report_only", reason: "Financial commitments cannot be cancelled — purchase manually after workload review." };
  }

  if (item.riskLevel === "high") {
    return { disposition: "report_only", reason: "Insufficient usage data to safely recommend this change. Collect more metrics first." };
  }

  if (confidence === "low") {
    return { disposition: "report_only", reason: "Signal confidence is low — not enough data to act on safely." };
  }

  if (item.riskLevel === "medium") {
    return { disposition: "approval_required", reason: "Moderate risk — usage data supports this change but a brief review is recommended." };
  }

  if (item.actionType === "apply_storage_policy") {
    if (item.resourceIds.length > 10) {
      return { disposition: "approval_required", reason: `Bulk policy change across ${item.resourceIds.length} resources — verify no hot-access buckets are included.` };
    }
    return { disposition: "auto_fix_candidate", reason: "Lifecycle policies are non-disruptive, apply asynchronously, and are fully reversible." };
  }

  if (item.actionType === "resize_compute") {
    if (item.resourceIds.length > 5) {
      return { disposition: "approval_required", reason: `Batch resize of ${item.resourceIds.length} instances — recommend rolling application with health checks.` };
    }
    return { disposition: "approval_required", reason: "Resize requires a brief instance restart. Approve to proceed." };
  }

  return { disposition: "approval_required", reason: "This action type requires explicit approval." };
}

// ---------------------------------------------------------------------------
// Finding → Recommendation conversion
// ---------------------------------------------------------------------------

export function findingToRecommendation(
  finding: AgentFinding,
  item: ExecutionPlanItem | null,
  confidence: ConfidenceScore,
  index: number,
): AgentRecommendation {
  const classified = item
    ? classifyDisposition(item, confidence)
    : { disposition: "report_only" as ActionDisposition, reason: "No actionable execution plan item." };

  return {
    id: `rec-${index + 1}`,
    findingId: finding.id,
    title: finding.title,
    rationale: finding.description,
    estimatedSavings: item ? item.estimatedSavings : null,
    actionType: item?.actionType ?? null,
    disposition: classified.disposition,
    dispositionReason: classified.reason,
    riskLevel: item?.riskLevel ?? null,
    effort: item ? effortFromAction(item.actionType) : "none",
    actionable: item !== null && classified.disposition !== "report_only",
  };
}

function effortFromAction(actionType: ActionType): "none" | "low" | "medium" | "high" {
  switch (actionType) {
    case "apply_storage_policy": return "low";
    case "resize_compute": return "medium";
    case "purchase_commitment": return "low";
    case "decommission_compute": return "high";
  }
}

// ---------------------------------------------------------------------------
// Priority scoring — determines the order the agent presents findings
// ---------------------------------------------------------------------------

export function priorityScore(finding: AgentFinding, savings: number): number {
  const severityWeight: Record<FindingSeverity, number> = { critical: 100, high: 75, medium: 50, low: 25, info: 10 };
  const confidenceWeight: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.4 };
  const categoryWeight: Record<FindingCategory, number> = { security: 1.3, resilience: 1.2, cost: 1.0, performance: 0.9, compliance: 1.1 };

  const base = severityWeight[finding.severity] ?? 10;
  const conf = confidenceWeight[finding.confidence] ?? 0.5;
  const cat = categoryWeight[finding.category] ?? 1.0;
  const savingsBoost = Math.min(savings / 100, 50);

  return Math.round(base * conf * cat + savingsBoost);
}

// ---------------------------------------------------------------------------
// Preference-aware variants — wrap base functions with org context
// ---------------------------------------------------------------------------

export function findingToRecommendationWithPrefs(
  finding: AgentFinding,
  item: ExecutionPlanItem | null,
  confidence: ConfidenceScore,
  index: number,
  prefs: OrgPreferences,
): AgentRecommendation {
  const classified = item
    ? classifyDispositionWithPrefs(item, confidence, prefs)
    : { disposition: "report_only" as ActionDisposition, reason: "No actionable execution plan item." };

  return {
    id: `rec-${index + 1}`,
    findingId: finding.id,
    title: finding.title,
    rationale: finding.description,
    estimatedSavings: item ? item.estimatedSavings : null,
    actionType: item?.actionType ?? null,
    disposition: classified.disposition,
    dispositionReason: classified.reason,
    riskLevel: item?.riskLevel ?? null,
    effort: item ? effortFromAction(item.actionType) : "none",
    actionable: item !== null && classified.disposition !== "report_only",
  };
}

export function classifyDispositionWithPrefs(
  item: ExecutionPlanItem,
  confidence: ConfidenceScore,
  prefs: OrgPreferences,
): { disposition: ActionDisposition; reason: string } {
  const base = classifyDisposition(item, confidence);

  const afterPolicy = applyDispositionPolicy(base.disposition, item, prefs);
  const afterRisk = applyRiskTolerance(afterPolicy, item.riskLevel, prefs.riskTolerance);

  if (afterRisk !== base.disposition) {
    const policyNote = afterRisk === "approval_required"
      ? ` Organization policy (${prefs.approvalPolicy}) requires approval for this action.`
      : afterRisk === "report_only"
        ? ` Organization risk tolerance (${prefs.riskTolerance}) restricts this to report-only.`
        : "";
    return { disposition: afterRisk, reason: base.reason + policyNote };
  }

  return base;
}

export function priorityScoreWithPrefs(
  finding: AgentFinding,
  savings: number,
  prefs: OrgPreferences,
): number {
  const base = priorityScore(finding, savings);
  const boost = categoryBoost(finding.category, prefs);
  return Math.round(base * boost);
}
