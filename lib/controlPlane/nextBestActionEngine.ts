/**
 * Next-Best-Action Engine.
 *
 * Ranks what Axiom should do next using normalised inputs from the
 * control plane builder. Pure function — never reads from disk, never
 * mutates state. Returns ordered `NextBestAction[]` the UI + APIs +
 * autonomous loop all consume.
 *
 * Hard rules:
 *  - Contact / book-a-call is never primary.
 *  - Self-serve actions outrank contact fallbacks.
 *  - Blocked actions still appear with a `blockedReason` + safe alternative.
 */

import type {
  NextBestAction,
  ProviderControlState,
  ConnectorControlState,
  ActionCategory,
} from "@/lib/controlPlane/controlPlaneModel";
import type { CoverageGap } from "@/lib/cloud/coverageGapAnalyzer";
import type { FeedbackSummary } from "@/lib/memory/feedbackLoop";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface NextBestActionInput {
  providers: ProviderControlState[];
  connectors: ConnectorControlState[];
  securityFailing: number;
  remediationCandidates: number;
  releaseBlockerCount: number;
  approvalsPending: number;
  coverageGaps: CoverageGap[];
  validationBrokenFlows: number;
  memorySummary: FeedbackSummary;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

let nextActionCounter = 0;
function actionId(prefix: string): string {
  nextActionCounter += 1;
  return `${prefix}.${nextActionCounter}`;
}

function mkAction(input: {
  prefix: string;
  title: string;
  description: string;
  category: ActionCategory;
  priority: number;
  riskLevel: NextBestAction["riskLevel"];
  provider?: NextBestAction["provider"];
  connector?: NextBestAction["connector"];
  sourceSystem: string;
  approvalRequired?: boolean;
  desktopEligible?: boolean;
  canRunNow?: boolean;
  blockedReason?: string;
  route?: string;
  actionType?: NextBestAction["actionType"];
  evidence?: { label: string; ref: string }[];
}): NextBestAction {
  return {
    id: actionId(input.prefix),
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    riskLevel: input.riskLevel,
    provider: input.provider,
    connector: input.connector,
    sourceSystem: input.sourceSystem,
    approvalRequired: input.approvalRequired ?? false,
    desktopEligible: input.desktopEligible ?? false,
    canRunNow: input.canRunNow ?? true,
    blockedReason: input.blockedReason,
    route: input.route,
    actionType: input.actionType ?? "navigate",
    evidenceRefs: input.evidence ?? [],
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function computeNextBestActions(input: NextBestActionInput): NextBestAction[] {
  nextActionCounter = 0;
  const out: NextBestAction[] = [];

  // 1. Connect provider — top priority when not connected.
  for (const p of input.providers) {
    if (p.sourceMode === "live") continue;
    out.push(mkAction({
      prefix: `connect.${p.provider}`,
      title: `Connect ${p.provider.toUpperCase()}`,
      description: p.sourceMode === "preview"
        ? `${p.provider.toUpperCase()} is running in preview mode. Connect to surface live findings.`
        : `${p.provider.toUpperCase()} setup is required.`,
      category: "connect_provider",
      priority: 95,
      riskLevel: "high",
      provider: p.provider,
      sourceSystem: "control_plane",
      route: "/operator/onboarding",
      actionType: "navigate",
      evidence: [{ label: "validation", ref: p.validationStatus }],
    }));
  }

  // 2. Resolve validation broken flows.
  if (input.validationBrokenFlows > 0) {
    out.push(mkAction({
      prefix: "validation.fix",
      title: `Resolve ${input.validationBrokenFlows} broken validation flow(s)`,
      description: "The autonomous validation loop flagged failing probes that prevent live execution.",
      category: "fix_config",
      priority: 88,
      riskLevel: "high",
      sourceSystem: "validation",
      route: "/dashboard/validation",
      actionType: "navigate",
    }));
  }

  // 3. Security failing.
  if (input.securityFailing > 0) {
    out.push(mkAction({
      prefix: "security.review",
      title: `Review ${input.securityFailing} failing security finding(s)`,
      description: "Security scanner has failing checks. Open the scanner to see narratives + remediation candidates.",
      category: "review_finding",
      priority: 85,
      riskLevel: "high",
      sourceSystem: "security_scanner",
      route: "/dashboard/security-scanner",
      actionType: "navigate",
    }));
  }

  // 4. Remediation candidates ready.
  if (input.remediationCandidates > 0) {
    out.push(mkAction({
      prefix: "remediation.review",
      title: `Review ${input.remediationCandidates} remediation candidate(s)`,
      description: "Each candidate ships with Terraform / CLI / rollback / verification.",
      category: "remediate",
      priority: 80,
      riskLevel: "medium",
      sourceSystem: "remediation_pipeline",
      route: "/dashboard/remediation",
      actionType: "navigate",
    }));
  }

  // 5. Simulations ready.
  if (input.remediationCandidates > 0) {
    out.push(mkAction({
      prefix: "simulate.review",
      title: "Preflight changes in the simulation center",
      description: "Simulate every candidate against the digital twin before approval.",
      category: "simulate",
      priority: 70,
      riskLevel: "low",
      sourceSystem: "simulation",
      route: "/dashboard/simulations",
      actionType: "navigate",
    }));
  }

  // 6. Release blockers.
  if (input.releaseBlockerCount > 0) {
    out.push(mkAction({
      prefix: "releaseops.review",
      title: `Resolve ${input.releaseBlockerCount} release blocker(s)`,
      description: "ReleaseOps has blockers that prevent production deployment.",
      category: "review_finding",
      priority: 78,
      riskLevel: "high",
      provider: "github",
      sourceSystem: "releaseops",
      route: "/dashboard/releaseops",
      actionType: "navigate",
    }));
  }

  // 7. Pending approvals.
  if (input.approvalsPending > 0) {
    out.push(mkAction({
      prefix: "approval.review",
      title: `${input.approvalsPending} pending approval(s) need a decision`,
      description: "Open the orchestration center to approve or reject pending work.",
      category: "request_approval",
      priority: 90,
      riskLevel: "high",
      sourceSystem: "approval_engine",
      approvalRequired: true,
      route: "/dashboard/orchestration",
      actionType: "navigate",
    }));
  }

  // 8. GitHub connector.
  const gh = input.connectors.find((c) => c.connector === "github");
  if (gh && gh.sourceMode !== "live") {
    out.push(mkAction({
      prefix: "connect.github",
      title: "Connect GitHub",
      description: "Connect the GitHub App for live ReleaseOps signals + branch protection scanning.",
      category: "connect_provider",
      priority: 75,
      riskLevel: "medium",
      connector: "github",
      sourceSystem: "control_plane",
      route: "/dashboard/integrations/github",
      actionType: "navigate",
    }));
  }

  // 9. Coverage gaps.
  for (const gap of input.coverageGaps.filter((g) => g.severity === "critical" || g.severity === "high").slice(0, 3)) {
    out.push(mkAction({
      prefix: `gap.${gap.coverageRef}`,
      title: `Address gap: ${gap.title}`,
      description: gap.selfServeExplanation,
      category: "fix_config",
      priority: gap.severity === "critical" ? 82 : 65,
      riskLevel: gap.severity === "critical" ? "high" : "medium",
      sourceSystem: "coverage_gap_analyzer",
      route: "/dashboard/validation",
      actionType: "navigate",
    }));
  }

  // 10. Memory-informed nudges.
  if (input.memorySummary.weights.approvalDelayCount >= 3) {
    out.push(mkAction({
      prefix: "memory.approval_delay",
      title: "Approval delays detected — review approver coverage",
      description: "Memory feedback shows multiple approval delays. Add more approvers or relax non-critical policies.",
      category: "fix_config",
      priority: 55,
      riskLevel: "medium",
      sourceSystem: "memory",
      route: "/dashboard/orchestration",
      actionType: "navigate",
    }));
  }

  // 11. Safe autonomous tasks the loop can run without a user click.
  out.push(mkAction({
    prefix: "safe.run_validation",
    title: "Run autonomous validation loop",
    description: "Refresh the validation matrix score with bounded, non-destructive probes.",
    category: "validate",
    priority: 30,
    riskLevel: "low",
    sourceSystem: "validation",
    route: "/api/validation/run",
    actionType: "run_safe_task",
    canRunNow: true,
  }));
  out.push(mkAction({
    prefix: "safe.security_scan",
    title: "Run security scan",
    description: "Refresh the typed security check results.",
    category: "scan",
    priority: 35,
    riskLevel: "low",
    sourceSystem: "security_scanner",
    route: "/api/security-scan",
    actionType: "run_safe_task",
    canRunNow: true,
  }));

  // 12. Always present documentation last-resort.
  out.push(mkAction({
    prefix: "docs",
    title: "Open setup guide",
    description: "Self-serve setup guide. Contact is a fallback, not the primary path.",
    category: "documentation",
    priority: 10,
    riskLevel: "low",
    sourceSystem: "documentation",
    route: "/docs/setup",
    actionType: "navigate",
    canRunNow: true,
  }));

  return out.sort((a, b) => b.priority - a.priority);
}
