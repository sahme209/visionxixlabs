/**
 * Executive Operational Summary builder.
 *
 * Pure read-only composition over canonical state. Consumes:
 *   - PriorityReport (for top risks + recommended action)
 *   - AxiomOSState   (for readiness + trust + safety contract)
 *   - IntegrationHealthReport (for health rollup)
 *
 * Produces a single shape an executive can read in 30 seconds. Every
 * number is real or honestly labeled. No fake trends.
 */

import "server-only";

import { buildPriorityReport } from "./priorityEngine";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { buildIntegrationHealthReport } from "@/lib/integrations/integrationHealthChecker";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  ExecutiveOverallStatus,
  ExecutiveSummaryReport,
  ExecutiveTopRisk,
} from "./executiveSummaryModel";

export interface BuildExecutiveSummaryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildExecutiveSummary(input: BuildExecutiveSummaryInput): Promise<ExecutiveSummaryReport> {
  const [priorities, state, health] = await Promise.all([
    buildPriorityReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildIntegrationHealthReport({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  // ---------------------------------------------------------------------------
  // Top 3 risks — from the priority report
  // ---------------------------------------------------------------------------
  const topRisks: ExecutiveTopRisk[] = priorities.items.slice(0, 3).map((p) => ({
    rank: p.rank,
    title: p.title,
    reasonSummary: p.reasonSummary,
    severity: p.severity,
    sourceMode: p.sourceMode,
    confidence: p.confidence,
    route: p.safeNextAction,
    evidenceRefs: p.evidenceRefs,
  }));

  // ---------------------------------------------------------------------------
  // Overall status — derive from the worst signal we have
  // ---------------------------------------------------------------------------
  const criticalCount = priorities.summary.critical;
  const blockedSources = health.summary.blocked;
  const overallStatus: ExecutiveOverallStatus =
    criticalCount > 0                                   ? "needs_attention" :
    blockedSources > 0                                  ? "blocked"         :
    state.sourceMode === "preview"                      ? "preview_mode"    :
    state.sourceMode === "expanding"                    ? "expanding"       :
    priorities.summary.high > 0                         ? "needs_attention" :
                                                          "operating_normally";

  // ---------------------------------------------------------------------------
  // Executive headline (one sentence) + narrative (2-4 sentences)
  // ---------------------------------------------------------------------------
  const headline = buildHeadline({ overallStatus, criticalCount, blockedSources, sourceMode: state.sourceMode });
  const narrative = buildNarrative({
    overallStatus,
    criticalCount,
    highCount: priorities.summary.high,
    healthHealthy: health.summary.healthy,
    healthTotal: health.summary.total,
    blockedSources,
    readinessPct: Math.round(state.readinessScore * 100),
    pendingApprovals: state.approvalPosture.data.pendingCount,
    sourceMode: state.sourceMode,
  });

  // ---------------------------------------------------------------------------
  // Readiness summary
  // ---------------------------------------------------------------------------
  const readinessTopBlockers = priorities.items
    .filter((p) => p.category === "readiness_blocker" || p.severity === "critical" || p.severity === "high")
    .slice(0, 3)
    .map((p) => p.title);

  // ---------------------------------------------------------------------------
  // Integration summary
  // ---------------------------------------------------------------------------
  const weakest = health.entries
    .filter((e) => e.status !== "healthy")
    .sort((a, b) => sortConfidenceWeight(a.status) - sortConfidenceWeight(b.status))[0];

  // ---------------------------------------------------------------------------
  // Trust summary — derived from canonical evidence/controls posture
  // ---------------------------------------------------------------------------
  const evidence = state.evidencePosture.data;
  const trustControlPct = Math.round(state.trustScore * 100);

  // ---------------------------------------------------------------------------
  // Recommended next action — top of the priority queue's safeNextAction
  // ---------------------------------------------------------------------------
  const topPriority = priorities.items[0];
  const recommendedNextAction = topPriority
    ? {
        title: topPriority.title,
        reason: topPriority.whyItMatters,
        route: topPriority.safeNextAction,
      }
    : {
        title: "Open Command Center",
        reason: "No priority work surfaced — review canonical state to confirm.",
        route: { label: "Open Command Center", href: "/dashboard/command-center" },
      };

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),

    overallStatus,
    headline,
    narrative,

    topRisks,
    readiness: {
      launchScore: Math.round(state.readinessScore * 100),
      productionScore: Math.round(state.readinessScore * 100) / 100,
      sourceMode: state.sourceMode,
      topBlockers: readinessTopBlockers,
    },
    integrationHealth: {
      total:    health.summary.total,
      healthy:  health.summary.healthy,
      preview:  health.summary.preview + health.summary.degraded,
      blocked:  health.summary.blocked,
      weakestIntegration: weakest?.label,
    },
    trust: {
      controlCoveragePct: trustControlPct,
      evidenceRecords: evidence.totalRecords,
      verifiedEvidence: evidence.verifiedRecords,
      readOnlyByDefault: true,
      approvalGated: true,
      desktopLocalExecution: "disabled",
    },

    recommendedNextAction,
    honestLimitations: [
      ...state.limitations.slice(0, 3),
      ...priorities.limitations.slice(0, 1),
    ],
    evidenceRefs: [
      "axiomOS:state",
      "intelligence:priorityReport",
      "integrationHealth:report",
      ...(topPriority?.evidenceRefs?.slice(0, 2) ?? []),
    ],
    safetyContract: "approval_gated_no_destructive_execution",
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function buildHeadline(o: {
  overallStatus: ExecutiveOverallStatus;
  criticalCount: number;
  blockedSources: number;
  sourceMode: string;
}): string {
  if (o.criticalCount > 0) {
    return `${o.criticalCount} critical operator action${o.criticalCount === 1 ? "" : "s"} require${o.criticalCount === 1 ? "s" : ""} attention.`;
  }
  if (o.blockedSources > 0) {
    return `${o.blockedSources} integration source${o.blockedSources === 1 ? "" : "s"} blocked — operator configuration required.`;
  }
  if (o.overallStatus === "preview_mode") {
    return "Operating in preview mode — connect credentials to unlock live read-only signals.";
  }
  if (o.overallStatus === "expanding") {
    return "Platform is expanding — adapter foundation in place, live signals coming online.";
  }
  return "All canonical signals operating normally — no critical operator action required.";
}

function buildNarrative(o: {
  overallStatus: ExecutiveOverallStatus;
  criticalCount: number;
  highCount: number;
  healthHealthy: number;
  healthTotal: number;
  blockedSources: number;
  readinessPct: number;
  pendingApprovals: number;
  sourceMode: string;
}): string {
  const sentences: string[] = [];

  if (o.criticalCount > 0 || o.highCount > 0) {
    sentences.push(
      `${o.criticalCount} critical + ${o.highCount} high priority items are in the operator queue.`,
    );
  } else {
    sentences.push("Operator queue holds no critical or high priorities at this snapshot.");
  }

  sentences.push(
    `Integration health: ${o.healthHealthy}/${o.healthTotal} sources healthy${o.blockedSources > 0 ? `, ${o.blockedSources} blocked` : ""}.`,
  );

  sentences.push(
    `Readiness composite is ${o.readinessPct}% (source mode: ${o.sourceMode.replace(/_/g, " ")}).`,
  );

  if (o.pendingApprovals > 0) {
    sentences.push(`${o.pendingApprovals} approval${o.pendingApprovals === 1 ? " is" : "s are"} pending operator decision.`);
  } else {
    sentences.push("No approvals pending — every change path is currently clear.");
  }

  return sentences.join(" ");
}

function sortConfidenceWeight(status: string): number {
  return status === "blocked"  ? 0 :
         status === "degraded" ? 1 :
         status === "preview"  ? 2 :
         status === "disabled" ? 3 :
                                  4;
}
