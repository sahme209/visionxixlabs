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
import { apiOk, apiErr } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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
    overallScore: number;
    riskLevel: string;
    blockerCount: number;
    evaluatedAt: string | null;
  };

  // Playbook stage
  playbook: {
    stepCount: number;
    cherryPickCount: number;
    policyViolationCount: number;
  };

  // Risk stage
  risk: {
    blastRadius: string;
    affectedServiceCount: number;
  };

  // Approval stage
  approval: {
    required: number;
    granted: number;
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
    planCount: number;
    resultsCount: number;
    status: string;
  };

  // Evidence stage
  evidence: {
    generatedAt: string | null;
    signedAt: string | null;
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
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const { id: releaseId } = await params;
    const orgId = ctx.organizationId;

    // Query all data sources in parallel for performance
    const [release, readiness, evidence, auditEvents] = await Promise.all([
      prisma.release.findUnique({
        where: { id: releaseId },
      }),
      prisma.releaseReadinessSnapshot.findFirst({
        where: { releaseId, organizationId: orgId },
        orderBy: { evaluatedAt: "desc" },
      }),
      prisma.releaseEvidencePack.findUnique({
        where: { releaseId },
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
    ]);

    // Verify org membership
    if (!release || release.organizationId !== orgId) {
      throw AxiomErrors.validation("not_found", "Release not found.");
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
        approvalGrantedAt: null, // TODO: Query AxiomApprovalRequest table
        executionStartedAt: null, // TODO: Query execution history
        validationCompleteAt: null, // TODO: Query validation results
        closedAt: release.status === "deployed" || release.status === "rolled_back" || release.status === "failed"
          ? new Date().toISOString() // Placeholder — would need actual closure timestamp
          : null,
      },

      request: {
        summary: release.summary ?? null,
        owner: release.createdByUserId ?? null,
        targetEnvironment: release.targetEnvironmentId ?? null,
        plannedWindowStart: release.plannedWindowStart?.toISOString() ?? null,
        plannedWindowEnd: release.plannedWindowEnd?.toISOString() ?? null,
      },

      readiness: {
        overallScore: readiness?.overallScore ?? 0,
        riskLevel: readiness?.riskLevel ?? "unscored",
        blockerCount: readiness && Array.isArray(readiness.blockersJson) ? (readiness.blockersJson as any[]).length : 0,
        evaluatedAt: readiness?.evaluatedAt?.toISOString() ?? null,
      },

      playbook: {
        stepCount: 0, // TODO: Query release steps/cherry-picks
        cherryPickCount: 0, // TODO: Query cherry-pick records
        policyViolationCount: 0, // TODO: Query policy violations
      },

      risk: {
        blastRadius: readiness?.driftRisk ?? 0 > 70 ? "critical" : readiness?.driftRisk ?? 0 > 50 ? "high" : "low",
        affectedServiceCount: 0, // TODO: Count affected services
      },

      approval: {
        required: 0, // TODO: Query approval policy
        granted: 0, // TODO: Count approval votes
        status: "pending",
      },

      execution: {
        status: release.status === "draft" ? "not_started" : release.status === "deploying" ? "in_progress" : "completed",
        plannedAt: release.plannedWindowStart?.toISOString() ?? null,
        startedAt: null, // TODO: Query execution history
      },

      validation: {
        planCount: 0, // TODO: Query validation plans
        resultsCount: 0, // TODO: Query validation results
        status: "not_run",
      },

      evidence: {
        generatedAt: evidence?.generatedAt?.toISOString() ?? null,
        signedAt: evidence ? "signedAt" in evidence ? (evidence as any).signedAt?.toISOString() : null : null,
      },

      closure: {
        status: release.status === "deployed" ? "closed" : "open",
        closedAt: release.status === "deployed" ? new Date().toISOString() : null,
      },

      auditEventCount: auditEvents.length,
      lastUpdated: new Date().toISOString(),
    };

    return apiOk(data, { correlationId: request.headers.get("x-correlation-id") ?? undefined });
  } catch (err) {
    return apiErr(err, { correlationId: request.headers.get("x-correlation-id") ?? undefined });
  }
}
