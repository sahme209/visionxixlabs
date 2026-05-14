/**
 * Plan explainability engine.
 *
 * Turns an ExecutionPlanCandidate + supporting context into a structured
 * explanation a human (or a copilot answering a human) can read end-to-end:
 *
 *   "Why is this plan being proposed?" → the recommendation + signals
 *   "What evidence supports it?"      → the findings / snapshots / memory
 *   "What policy applies?"            → the policy decision + reason
 *   "What changes?"                   → the typed phases + artifacts
 *   "How risky is it?"                → the risk + blast radius + blockers
 *   "What's the rollback story?"      → the rollback strategy + verification
 *   "What needs to happen first?"     → preflight checks the plan declares
 *
 * Pure function — does no IO. Consumed by the Approval Center, Execution
 * Detail page, copilot evidence panel, and the audit bundle generator.
 */

import type { ExecutionPlanCandidate, PlanPhase } from "@/lib/execution/executionPlanBuilder";
import type { PolicyDecision } from "@/lib/safety/approvalPolicy";

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export type ExplanationSemantic = "neutral" | "success" | "warning" | "error" | "info";

export interface ExplanationSection {
  id: string;
  /** Section heading rendered in the UI. */
  title: string;
  /** One-line summary — the most important fact in this section. */
  headline: string;
  /** Bullet detail. Each item is a short sentence. */
  bullets: string[];
  semantic: ExplanationSemantic;
}

export interface PlanExplanation {
  planId: string;
  /** Title rendered above the explanation. */
  title: string;
  /** Multi-sentence summary — the elevator pitch. */
  summary: string;
  /** Risk read for the plan as a whole. */
  riskBadge: { label: string; semantic: ExplanationSemantic };
  /** Sections, rendered top-to-bottom. */
  sections: ExplanationSection[];
  /** Decision summary: what the policy engine returned. */
  decisionLine: string;
  /** Final readiness flag — true when the plan is actionable now. */
  readyToProceed: boolean;
  /** Safe next action for the user. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Input context
// ---------------------------------------------------------------------------

export interface PlanExplainerContext {
  /** Evidence references — findings, memories, snapshots that motivate the plan. */
  evidence: { kind: "finding" | "snapshot" | "memory" | "metric" | "trace"; label: string }[];
  /** Preflight gates that must pass before execution. */
  preflightChecks?: { label: string; ok: boolean; detail?: string }[];
  /** Environment the plan targets. */
  environment?: "production" | "staging" | "qa" | "development";
  /** Whether the plan's recommendation comes from a winning success streak. */
  successStreak?: number;
  /** Linked release id when the plan participates in a ReleaseOps flow. */
  releaseId?: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function explainPlan(plan: ExecutionPlanCandidate, ctx: PlanExplainerContext = { evidence: [] }): PlanExplanation {
  const sections: ExplanationSection[] = [];

  // 1. Why
  sections.push({
    id: "why",
    title: "Why this plan?",
    headline: plan.summary,
    bullets: [
      `Proposed from recommendation ${plan.recommendationId}.`,
      `Targets ${plan.phases.reduce((s, p) => s + p.affectedResources.length, 0)} resource(s) across ${plan.phases.length} phase(s).`,
      ...(plan.monthlySavingsUsd ? [`Estimated monthly impact: $${plan.monthlySavingsUsd.toLocaleString()}.`] : []),
      ...(ctx.successStreak !== undefined && ctx.successStreak > 0 ? [`Success streak for this recommendation class: ${ctx.successStreak}.`] : []),
    ],
    semantic: "info",
  });

  // 2. Evidence
  if (ctx.evidence.length > 0) {
    sections.push({
      id: "evidence",
      title: "Evidence",
      headline: `${ctx.evidence.length} reference${ctx.evidence.length === 1 ? "" : "s"} feed this plan.`,
      bullets: ctx.evidence.slice(0, 8).map((e) => `${labelKind(e.kind)} · ${e.label}`),
      semantic: "info",
    });
  }

  // 3. What changes
  sections.push({
    id: "changes",
    title: "What changes",
    headline: `${plan.phases.length} phase${plan.phases.length === 1 ? "" : "s"}, ${plan.artifacts.length} artifact${plan.artifacts.length === 1 ? "" : "s"}.`,
    bullets: plan.phases.map((p) => phaseLine(p)).slice(0, 8),
    semantic: "info",
  });

  // 4. Risk
  sections.push({
    id: "risk",
    title: "Risk",
    headline: riskHeadline(plan.risk, plan.blockers.length),
    bullets: [
      `Plan risk: ${plan.risk}.`,
      `Blockers: ${plan.blockers.length === 0 ? "none" : plan.blockers.join("; ")}.`,
      ...(ctx.environment === "production" ? ["Target environment is production — extra-strict gates apply."] : []),
    ],
    semantic: plan.risk === "high" ? "error" : plan.risk === "medium" ? "warning" : "success",
  });

  // 5. Rollback
  sections.push({
    id: "rollback",
    title: "Rollback",
    headline: plan.rollback.verified ? "Rollback verified." : "Rollback not verified.",
    bullets: [
      `Strategy: ${plan.rollback.strategy}.`,
      `Estimated RTO: ${plan.rollback.rtoSec}s.`,
      plan.rollback.verified ? "Path tested in a recent rehearsal." : "Verify rollback in a non-production environment before proceeding.",
    ],
    semantic: plan.rollback.verified ? "success" : "warning",
  });

  // 6. Policy / approval
  sections.push({
    id: "policy",
    title: "Policy decision",
    headline: policyHeadline(plan.decision),
    bullets: policyBullets(plan.decision),
    semantic: !plan.decision.allowed ? "error" : plan.decision.approvalRequired ? "warning" : "success",
  });

  // 7. Preflight
  if (ctx.preflightChecks && ctx.preflightChecks.length > 0) {
    const failed = ctx.preflightChecks.filter((c) => !c.ok);
    sections.push({
      id: "preflight",
      title: "Preflight",
      headline: failed.length === 0
        ? "All preflight checks pass."
        : `${failed.length} preflight check${failed.length === 1 ? "" : "s"} failing.`,
      bullets: ctx.preflightChecks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}${c.detail ? ` · ${c.detail}` : ""}`),
      semantic: failed.length === 0 ? "success" : "warning",
    });
  }

  // Decision line + readiness
  const blocked = !plan.decision.allowed || plan.blockers.length > 0;
  const needsApproval = plan.decision.approvalRequired;
  const preflightOk = !ctx.preflightChecks || ctx.preflightChecks.every((c) => c.ok);
  const readyToProceed = !blocked && !needsApproval && preflightOk;

  const decisionLine =
    blocked         ? `Blocked: ${plan.decision.blockReason ?? plan.blockers[0] ?? "policy denied"}.` :
    needsApproval   ? `Requires human approval before execution: ${plan.decision.explanation}.` :
    !preflightOk    ? "Plan is otherwise approved, but preflight checks must pass first." :
                      "Plan is approved and ready to execute.";

  const safeNextAction: PlanExplanation["safeNextAction"] =
    blocked         ? { label: "Open governance", href: "/dashboard/governance" } :
    needsApproval   ? { label: "Open approvals", href: "/dashboard/approvals" } :
    !preflightOk    ? { label: "Review preflight", href: "/dashboard/command-center" } :
                      { label: "Open execution detail", href: "/dashboard/command-center" };

  return {
    planId: plan.id,
    title: plan.title,
    summary: plan.summary,
    riskBadge: {
      label: plan.risk,
      semantic: plan.risk === "high" ? "error" : plan.risk === "medium" ? "warning" : "success",
    },
    sections,
    decisionLine,
    readyToProceed,
    safeNextAction,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelKind(kind: "finding" | "snapshot" | "memory" | "metric" | "trace"): string {
  switch (kind) {
    case "finding":  return "Finding";
    case "snapshot": return "Snapshot";
    case "memory":   return "Memory";
    case "metric":   return "Metric";
    case "trace":    return "Trace";
  }
}

function phaseLine(p: PlanPhase): string {
  const auto = p.autoApplyEligible ? " · auto-apply eligible" : "";
  return `${p.number}. ${p.kind} · ${p.title}${auto} (~${p.estimatedDurationSec}s, ${p.affectedResources.length} resource${p.affectedResources.length === 1 ? "" : "s"})`;
}

function riskHeadline(risk: "low" | "medium" | "high", blockerCount: number): string {
  if (blockerCount > 0) return `${blockerCount} blocker${blockerCount === 1 ? "" : "s"} present.`;
  if (risk === "high")   return "High-risk plan — production-impacting.";
  if (risk === "medium") return "Medium-risk plan — review recommended.";
  return "Low-risk plan — contained blast radius.";
}

function policyHeadline(d: PolicyDecision): string {
  if (!d.allowed) {
    return `Policy blocks this plan${d.blockReason ? `: ${d.blockReason}` : "."}`;
  }
  if (d.approvalRequired) {
    return d.requirement
      ? `Requires ${d.requirement.count} approval(s) (${d.requirement.scope.replace(/_/g, " ")}).`
      : "Requires human approval.";
  }
  return d.autoApplyEligible ? "Policy allows auto-apply." : "Policy allows this plan.";
}

function policyBullets(d: PolicyDecision): string[] {
  const out: string[] = [];
  if (d.explanation) out.push(d.explanation);
  if (d.approvalRequired && d.requirement) {
    out.push(`Approver scope: ${d.requirement.scope}.`);
    if (d.requirement.externalChangeRequest) out.push("External change request (ServiceNow / Jira) required.");
    if (d.requirement.expirySec) out.push(`Approval expires after ${Math.round(d.requirement.expirySec / 60)} minute(s).`);
  }
  if (d.autoApplyEligible) out.push("Eligible for Trust Ladder auto-apply once approval clears.");
  return out;
}
