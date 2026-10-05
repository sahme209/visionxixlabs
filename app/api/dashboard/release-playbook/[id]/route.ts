/**
 * GET /api/dashboard/release-playbook/[id]
 *
 * Unified release playbook endpoint. Returns all stage data (request,
 * readiness, playbook, risk, approval, execution, validation, evidence,
 * closure) in a single structure so the playbook page can show the
 * complete release journey with progressive disclosure.
 *
 * This consolidates data from:
 * - release-detail
 * - readiness evaluation
 * - policy violations
 * - cherry-pick approvals
 * - approval chain
 * - execution status
 * - validation results
 * - evidence pack
 * - audit trail
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface DataSourceState {
  available: boolean;
  reason?: string; // Why unavailable (e.g., "schema not yet implemented")
}

interface UnifiedPlaybookResponse {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;

  // Journey timeline
  lifecycle: {
    requestedAt: string;
    requestedBy: string | null;
    scopeFinalizedAt: string | null;
    readinessScoredAt: string | null;
    approvalGrantedAt: string | null;
    executionStartedAt: string | null;
    validationCompleteAt: string | null;
    closedAt: string | null;
  };

  // Request stage
  request: {
    summary: string | null;
    owner: string | null;
    targetEnvironment: string | null;
    plannedWindowStart: string | null;
    plannedWindowEnd: string | null;
  };

  // Readiness stage
  readiness: {
    /** Unavailable (not 0) when no readiness snapshot has run yet — a
     *  fabricated 0 is indistinguishable from a genuine zero-risk score. */
    overallScore: number | DataSourceState;
    riskLevel: string;
    blockerCount: number | DataSourceState;
    evaluatedAt: string | null;
  };

  // Playbook stage
  playbook: {
    stepCount: number | DataSourceState;
    cherryPickCount: number;
    policyViolationCount: number;
  };

  // Risk stage
  risk: {
    blastRadius: string;
    affectedServiceCount: number | DataSourceState;
  };

  // Approval stage
  approval: {
    required: number | DataSourceState;
    granted: number;
    /** "not_evaluated" when no chain exists yet — distinct from a chain
     *  that exists and is genuinely "pending". */
    status: string;
  };

  // Execution stage
  execution: {
    status: string;
    plannedAt: string | null;
    startedAt: string | null;
  };

  // Validation stage
  validation: {
    planCount: number | DataSourceState;
    resultsCount: number | DataSourceState;
    status: string;
  };

  // Evidence stage
  evidence: {
    generatedAt: string | null;
    signedAt: string | null;
    /** Real GitHub PR/workflow-run evidence for this release's bound
     *  repository + commit. Unavailable (not a fake zero) when no
     *  evidence repository has been bound — see evidenceRepositoryId on
     *  the Release model. */
    githubEvidence: {
      pullRequestCount: number;
      workflowRunsTotal: number;
      workflowRunsSucceeded: number;
      workflowRunsFailed: number;
    } | DataSourceState;
  };

  // Closure stage
  closure: {
    status: string;
    closedAt: string | null;
  };

  // Audit
  auditEventCount: number;
  lastUpdated: string;
}

import type { ApiEnvelopeFailure } from "@/lib/api/apiEnvelope";

type ResponseBody =
  | { ok: true; data: UnifiedPlaybookResponse }
  | ApiEnvelopeFailure;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ResponseBody>> {
  // Obtain or generate correlation ID for this request
  const correlationId = resolveCorrelationId(request.headers);

  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const { id: releaseId } = await params;
    const orgId = ctx.organizationId;

    // Query all data sources in parallel for performance
    const [release, readiness, evidence, auditEvents, approvalChain, policyViolations, cherryPicks] = await Promise.all([
      prisma.release.findUnique({
        where: { id: releaseId },
      }),
      prisma.releaseReadinessSnapshot.findFirst({
        where: { releaseId, organizationId: orgId },
        orderBy: { evaluatedAt: "desc" },
      }),
      prisma.releaseEvidencePack.findFirst({
        where: { releaseId, organizationId: orgId },
      }),
      prisma.auditEvent.findMany({
        where: {
          organizationId: orgId,
          subjectId: releaseId,
          subjectKind: "release",
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.axiomApprovalChain.findFirst({
        where: {
          organizationId: orgId,
          approvalItemId: releaseId,
        },
        include: { votes: true },
      }),
      // Policy violations exist in schema; query them directly
      prisma.policyViolation.count({
        where: {
          releaseId,
          organizationId: orgId,
        },
      }),
      // Cherry-pick exceptions exist in schema; count them
      prisma.cherryPickException.count({
        where: {
          releaseId,
          organizationId: orgId,
        },
      }),
    ]);

    // Data sources that don't yet exist in schema
    const executionStepsUnavailable: DataSourceState = {
      available: false,
      reason: "Playbook step tracking is not yet implemented.",
    };
    const validationUnavailable: DataSourceState = {
      available: false,
      reason: "ReleaseValidation schema model not yet implemented",
    };
    const serviceImpactUnavailable: DataSourceState = {
      available: false,
      reason: "ReleaseServiceImpact schema model not yet implemented",
    };

    // Verify org membership
    if (!release || release.organizationId !== orgId) {
      throw AxiomErrors.validation("not_found", "Release not found.");
    }

    // GitHub evidence — only queryable once a repository has been bound
    // (release.evidenceRepositoryId) AND a commit is known. Depends on
    // `release`, so it can't join the Promise.all above. Reads already-
    // synced local records (repository-sync) rather than calling GitHub
    // live on every Playbook page load.
    let githubEvidence: UnifiedPlaybookResponse["evidence"]["githubEvidence"] = {
      available: false,
      reason: !release.evidenceRepositoryId
        ? "No evidence repository bound to this release"
        : "Release has no commitSha recorded yet",
    };
    if (release.evidenceRepositoryId && release.commitSha) {
      const [pullRequests, workflowRuns] = await Promise.all([
        prisma.pullRequestRecord.findMany({
          where: { organizationId: orgId, repositoryId: release.evidenceRepositoryId, commitShaHead: release.commitSha },
          select: { id: true },
        }),
        prisma.workflowRunRecord.findMany({
          where: { organizationId: orgId, repositoryId: release.evidenceRepositoryId, commitSha: release.commitSha },
          select: { conclusion: true },
        }),
      ]);
      githubEvidence = {
        pullRequestCount: pullRequests.length,
        workflowRunsTotal: workflowRuns.length,
        workflowRunsSucceeded: workflowRuns.filter((w) => w.conclusion === "success").length,
        workflowRunsFailed: workflowRuns.filter((w) => w.conclusion === "failure").length,
      };
    }

    // Build the unified response
    const data: UnifiedPlaybookResponse = {
      id: releaseId,
      releaseTag: release.releaseTag ?? null,
      commitSha: release.commitSha ?? null,
      status: release.status,

      lifecycle: {
        requestedAt: release.createdAt.toISOString(),
        requestedBy: release.createdByUserId ?? null,
        scopeFinalizedAt: release.scopeFinalizedAt?.toISOString() ?? null,
        readinessScoredAt: readiness?.evaluatedAt?.toISOString() ?? null,
        approvalGrantedAt: approvalChain?.resolvedAt?.toISOString() ?? null,
        executionStartedAt: release.actualDeployStart?.toISOString() ?? null,
        validationCompleteAt: null, // TODO: Query validation completion timestamp
        closedAt: release.actualDeployEnd?.toISOString() ?? null,
      },

      request: {
        summary: release.summary ?? null,
        owner: release.createdByUserId ?? null,
        targetEnvironment: release.targetEnvironmentId ?? null,
        plannedWindowStart: release.plannedWindowStart?.toISOString() ?? null,
        plannedWindowEnd: release.plannedWindowEnd?.toISOString() ?? null,
      },

      readiness: {
        overallScore: readiness
          ? readiness.overallScore
          : { available: false, reason: "No readiness snapshot has been evaluated yet." },
        riskLevel: readiness?.riskLevel ?? "unscored",
        blockerCount: readiness
          ? (Array.isArray(readiness.blockersJson) ? (readiness.blockersJson as any[]).length : 0)
          : { available: false, reason: "No readiness snapshot has been evaluated yet." },
        evaluatedAt: readiness?.evaluatedAt?.toISOString() ?? null,
      },

      playbook: {
        stepCount: executionStepsUnavailable,
        cherryPickCount: cherryPicks,
        policyViolationCount: policyViolations,
      },

      risk: {
        blastRadius: !readiness
          ? "unscored"
          : readiness.driftRisk > 70
            ? "critical"
            : readiness.driftRisk > 50
              ? "high"
              : "low",
        affectedServiceCount: serviceImpactUnavailable,
      },

      approval: {
        // required=0 is a real policy decision ("no approvals needed"); an
        // absent chain means approval hasn't been evaluated at all yet.
        // Conflating the two previously made "not yet evaluated" render as
        // "Not Required" in the UI.
        required: approvalChain
          ? approvalChain.requiredCount
          : { available: false, reason: "Approval chain not yet created — readiness or policy evaluation has not run." },
        granted: approvalChain?.votes.filter((v: any) => v.decision === "approve").length ?? 0,
        status: approvalChain?.status ?? "not_evaluated",
      },

      execution: {
        status: release.status === "deploying"
          ? "in_progress"
          : release.status === "deployed"
            ? "completed"
            : release.status === "rolled_back"
              ? "rolled_back"
              : release.status === "failed"
                ? "failed"
                : "not_started", // draft | ready
        plannedAt: release.plannedWindowStart?.toISOString() ?? null,
        startedAt: release.actualDeployStart?.toISOString() ?? null,
      },

      validation: {
        planCount: validationUnavailable,
        resultsCount: validationUnavailable,
        status: "unavailable",
      },

      evidence: {
        generatedAt: evidence?.generatedAt?.toISOString() ?? null,
        signedAt: evidence?.signedAt?.toISOString() ?? null,
        githubEvidence,
      },

      closure: {
        status: release.status === "deployed"
          ? "closed"
          : release.status === "failed" || release.status === "rolled_back"
            ? "terminated"
            : "open",
        closedAt: release.actualDeployEnd?.toISOString() ?? null,
      },

      auditEventCount: auditEvents.length,
      lastUpdated: new Date().toISOString(),
    };

    return apiOk(data, { correlationId });
  } catch (err) {
    return apiErr(err, { correlationId });
  }
}
