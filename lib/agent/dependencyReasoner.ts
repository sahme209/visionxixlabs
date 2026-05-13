/**
 * Dependency-aware reasoner.
 *
 * Wraps the base snapshotReasoner with graph-based reasoning. Each
 * recommendation gets a typed DependencyAnalysis attached: what depends
 * on this resource, what could be affected, rollback complexity, and a
 * dependency-aware confidence/approval adjustment.
 *
 * Pure function over typed contracts. No I/O.
 */

import type { CloudSnapshot } from "@/lib/cloud/snapshotModel";
import type { ReasonedRecommendation, ReasonerOutput } from "@/lib/agent/snapshotReasoner";
import { reasonAboutSnapshot } from "@/lib/agent/snapshotReasoner";
import type { InfrastructureGraph } from "@/lib/graph/infrastructureGraph";
import { analyzeBlastRadius, type BlastRadiusReport } from "@/lib/graph/blastRadius";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface DependencyAnalysis {
  recommendationId: string;
  /** Blast radius from the affected resource. */
  blastRadius: BlastRadiusReport;
  /** Whether dependency analysis raised the approval requirement. */
  approvalEscalated: boolean;
  /** Confidence delta in [-1, 1]. */
  confidenceDelta: number;
  /** Human-readable explanation surfaced to the user. */
  explanation: string;
}

export interface DependencyAwareOutput extends ReasonerOutput {
  recommendations: ReasonedRecommendation[];
  /** Per-recommendation dependency analysis. */
  dependencyAnalysis: Record<string, DependencyAnalysis>;
}

// ---------------------------------------------------------------------------
// Reasoner
// ---------------------------------------------------------------------------

export function reasonWithDependencies(
  snapshot: CloudSnapshot,
  graph: InfrastructureGraph
): DependencyAwareOutput {
  const base = reasonAboutSnapshot(snapshot);
  const analyses: Record<string, DependencyAnalysis> = {};

  const adjusted: ReasonedRecommendation[] = [];

  for (const rec of base.recommendations) {
    const resourceId = extractResourceId(rec);
    if (!resourceId) {
      adjusted.push(rec);
      continue;
    }
    const nodeId = `resource_${snapshot.resources[0]?.ref.provider ?? "aws"}_${resourceId}`;
    const blastRadius = analyzeBlastRadius(graph, nodeId);

    const escalate = shouldEscalateApproval(blastRadius);
    const confidenceDelta = computeConfidenceDelta(blastRadius);

    analyses[rec.id] = {
      recommendationId: rec.id,
      blastRadius,
      approvalEscalated: escalate,
      confidenceDelta,
      explanation: buildExplanation(blastRadius, escalate),
    };

    adjusted.push({
      ...rec,
      confidence: Math.max(0, Math.min(1, rec.confidence + confidenceDelta)),
      approvalRequired: rec.approvalRequired || escalate,
      risk: blastRadius.score === "critical" || blastRadius.score === "broad" ? "high" :
            blastRadius.score === "moderate" ? "medium" :
            rec.risk,
    });
  }

  return { ...base, recommendations: adjusted, dependencyAnalysis: analyses };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function shouldEscalateApproval(blastRadius: BlastRadiusReport): boolean {
  if (blastRadius.score === "critical" || blastRadius.score === "broad") return true;
  if (blastRadius.productionAffected.length > 0) return true;
  if (blastRadius.rollbackComplexity === "high") return true;
  return false;
}

function computeConfidenceDelta(blastRadius: BlastRadiusReport): number {
  // Larger blast radius lowers confidence in the auto-applicability of the change.
  if (blastRadius.score === "critical") return -0.2;
  if (blastRadius.score === "broad") return -0.1;
  if (blastRadius.score === "moderate") return -0.05;
  return 0; // Contained — no change
}

function buildExplanation(blastRadius: BlastRadiusReport, escalated: boolean): string {
  const parts: string[] = [];
  parts.push(blastRadius.reason);
  if (escalated) parts.push("Approval requirement escalated based on graph analysis.");
  if (blastRadius.productionAffected.length > 0) {
    parts.push(`${blastRadius.productionAffected.length} production node${blastRadius.productionAffected.length !== 1 ? "s" : ""} reachable through dependencies.`);
  }
  if (blastRadius.rollbackComplexity === "high" || blastRadius.rollbackComplexity === "complex") {
    parts.push(`Rollback complexity: ${blastRadius.rollbackComplexity} — verify rollback path before approving.`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractResourceId(rec: ReasonedRecommendation): string | undefined {
  const m = rec.findingId.match(/finding_([^_]+)_/);
  return m?.[1];
}
