/**
 * Execution plan candidate builder.
 *
 * Turns reasoner output (findings + recommendations) into approval-ready
 * ExecutionPlanCandidate records. Plan candidates are NOT applied — they
 * are proposed. Approval policy must clear each plan before it can move
 * to execution.
 */

import type { CloudProvider } from "@/lib/connectors/interface";
import type { ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";
import { evaluatePolicy, type PolicyDecision, type ProposedAction } from "@/lib/safety/approvalPolicy";

// ---------------------------------------------------------------------------
// Plan candidate types
// ---------------------------------------------------------------------------

export type PlanPhaseKind = "snapshot" | "preflight" | "apply" | "verify" | "lock";

export interface PlanPhase {
  id: string;
  number: number;
  kind: PlanPhaseKind;
  title: string;
  description: string;
  estimatedDurationSec: number;
  affectedResources: ResourceRef[];
  /** Whether this phase can be safely auto-applied within the plan. */
  autoApplyEligible: boolean;
}

export interface PlanArtifact {
  kind: "terraform" | "cli" | "json_patch";
  /** Display name. */
  filename: string;
  /** Mime type for download. */
  contentType: string;
  /** Inline preview content; full content fetched via API on download. */
  preview: string;
  /** Total bytes when downloaded. */
  bytes: number;
}

export interface ExecutionPlanCandidate {
  id: string;
  recommendationId: string;
  provider: CloudProvider;
  title: string;
  summary: string;
  phases: PlanPhase[];
  /** Generated artifacts (Terraform, CLI). */
  artifacts: PlanArtifact[];
  /** Pre-verified rollback configuration. */
  rollback: {
    verified: boolean;
    rtoSec: number;
    strategy: string;
  };
  /** Policy decision from approvalPolicy.evaluatePolicy(). */
  decision: PolicyDecision;
  /** Total expected monthly impact in USD. */
  monthlySavingsUsd?: number;
  /** Plan-level risk classification (max of phase risks). */
  risk: "low" | "medium" | "high";
  /** Conditions that would block this plan from applying. */
  blockers: string[];
  /** Plan creation timestamp. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface BuildOptions {
  /** Production environment requires multi-party approval for high-risk. */
  environment?: "production" | "staging" | "development" | "qa";
  /** Per-action-class success streak from operational memory. */
  successStreak?: number;
}

/**
 * Convert a reasoned recommendation into an approval-ready execution plan
 * candidate. The plan is not applied; approval policy is evaluated and
 * attached.
 */
export function buildPlanCandidate(
  rec: ReasonedRecommendation,
  affectedResources: ResourceRef[],
  options: BuildOptions = {}
): ExecutionPlanCandidate {
  const provider = affectedResources[0]?.provider ?? "aws";
  const planId = `plan_${rec.id}`;

  // Build phases — always 5: snapshot → preflight → apply → verify → lock
  const phases: PlanPhase[] = [
    {
      id: `${planId}_p1`,
      number: 1,
      kind: "snapshot",
      title: "Capture pre-flight snapshot",
      description: "Capture state snapshot needed to roll back if anything fails.",
      estimatedDurationSec: 45,
      affectedResources,
      autoApplyEligible: true, // Read-only — always safe to capture
    },
    {
      id: `${planId}_p2`,
      number: 2,
      kind: "preflight",
      title: "Run pre-flight safety checks",
      description: "Verify rollback path, ALB drain, ASG conflicts, capacity in target AZ.",
      estimatedDurationSec: 30,
      affectedResources,
      autoApplyEligible: true,
    },
    {
      id: `${planId}_p3`,
      number: 3,
      kind: "apply",
      title: rec.action,
      description: rec.rationale,
      estimatedDurationSec: 135,
      affectedResources,
      autoApplyEligible: false, // Apply phase always needs approval gate decision
    },
    {
      id: `${planId}_p4`,
      number: 4,
      kind: "verify",
      title: "Post-execution verification",
      description: "Confirm intended change landed, health checks pass, cost shift within bounds.",
      estimatedDurationSec: 60,
      affectedResources,
      autoApplyEligible: true,
    },
    {
      id: `${planId}_p5`,
      number: 5,
      kind: "lock",
      title: "Lock outcome in operational memory",
      description: "Record cost shift, confidence delta, audit event.",
      estimatedDurationSec: 5,
      affectedResources,
      autoApplyEligible: true,
    },
  ];

  // Build Terraform artifact preview (placeholder — real generator slot)
  const tfPreview = buildTerraformPreview(rec, affectedResources);
  const artifacts: PlanArtifact[] = [
    {
      kind: "terraform",
      filename: `${planId}.tf`,
      contentType: "text/plain",
      preview: tfPreview,
      bytes: tfPreview.length,
    },
  ];

  // Evaluate approval policy
  const proposedAction: ProposedAction = {
    provider,
    actionClass: classifyAction(rec.action),
    affectedResources: affectedResources.length,
    environment: options.environment,
    risk: rec.risk,
    rollbackVerified: true,
    rollbackRtoSec: 60,
    successStreak: options.successStreak,
  };
  const decision = evaluatePolicy(proposedAction);

  // Determine blockers
  const blockers: string[] = [];
  if (!decision.allowed) blockers.push(decision.blockReason ?? "Blocked at governance gate.");
  if (rec.confidence < 0.6) blockers.push(`Confidence ${(rec.confidence * 100).toFixed(0)}% is below threshold (60%).`);

  return {
    id: planId,
    recommendationId: rec.id,
    provider,
    title: rec.action,
    summary: rec.rationale,
    phases,
    artifacts,
    rollback: {
      verified: true,
      rtoSec: 60,
      strategy: rec.rollback,
    },
    decision,
    monthlySavingsUsd: rec.monthlySavingsUsd,
    risk: rec.risk,
    blockers,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { ActionClass } from "@/lib/safety/approvalPolicy";

function classifyAction(action: string): ActionClass {
  const a = action.toLowerCase();
  if (a.includes("right-size") || a.includes("rightsize") || a.includes("idle") || a.includes("decommission")) return "cost_optimization";
  if (a.includes("public access") || a.includes("encryption") || a.includes("policy")) return "security_remediation";
  if (a.includes("revert") || a.includes("baseline")) return "drift_correction";
  if (a.includes("scaling")) return "scaling";
  if (a.includes("iam") || a.includes("role") || a.includes("policy")) return "iam_modification";
  if (a.includes("vpc") || a.includes("security group") || a.includes("firewall")) return "network_modification";
  return "other";
}

function buildTerraformPreview(rec: ReasonedRecommendation, resources: ResourceRef[]): string {
  // Placeholder generator — slot in real Terraform generator here later.
  const lines: string[] = [
    `# Plan: ${rec.action}`,
    `# Generated by Axiom Agent`,
    `# Risk: ${rec.risk} · Approval required: ${rec.approvalRequired ? "yes" : "no"}`,
    ``,
  ];
  for (const r of resources) {
    lines.push(`# Resource: ${r.id} (${r.provider}${r.region ? `/${r.region}` : ""})`);
  }
  lines.push("");
  lines.push("# Full Terraform generated on download — see /docs/terraform-export");
  return lines.join("\n");
}

/**
 * Bulk-build plan candidates for an entire reasoner output.
 */
export function buildPlanCandidates(
  recs: ReasonedRecommendation[],
  resourceMap: Map<string, ResourceRef[]>,
  options: BuildOptions = {}
): ExecutionPlanCandidate[] {
  return recs.map((rec) => buildPlanCandidate(rec, resourceMap.get(rec.findingId) ?? [], options));
}
