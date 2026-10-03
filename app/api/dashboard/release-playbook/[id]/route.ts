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

type ResponseBody =
  | { ok: true; data: UnifiedPlaybookResponse }
  | { ok: false; error: string; hint?: string };

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ResponseBody>> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const releaseId = params.id;

    // TODO: Fetch unified playbook data from database
    // This is a placeholder that would aggregate data from multiple sources:
    // - Release record
    // - Readiness evaluation
    // - Policy violations
    // - Cherry-pick approvals
    // - Approval chain
    // - Execution status
    // - Validation results
    // - Evidence pack
    // - Audit trail

    const data: UnifiedPlaybookResponse = {
      id: releaseId,
      releaseTag: null,
      commitSha: null,
      status: "draft",

      lifecycle: {
        requestedAt: new Date().toISOString(),
        requestedBy: ctx.userId ?? null,
        scopeFinalizedAt: null,
        readinessScoredAt: null,
        approvalGrantedAt: null,
        executionStartedAt: null,
        validationCompleteAt: null,
        closedAt: null,
      },

      request: {
        summary: null,
        owner: null,
        targetEnvironment: null,
        plannedWindowStart: null,
        plannedWindowEnd: null,
      },

      readiness: {
        overallScore: 0,
        riskLevel: "unscored",
        blockerCount: 0,
        evaluatedAt: null,
      },

      playbook: {
        stepCount: 0,
        cherryPickCount: 0,
        policyViolationCount: 0,
      },

      risk: {
        blastRadius: "unknown",
        affectedServiceCount: 0,
      },

      approval: {
        required: 0,
        granted: 0,
        status: "pending",
      },

      execution: {
        status: "not_started",
        plannedAt: null,
        startedAt: null,
      },

      validation: {
        planCount: 0,
        resultsCount: 0,
        status: "not_run",
      },

      evidence: {
        generatedAt: null,
        signedAt: null,
      },

      closure: {
        status: "open",
        closedAt: null,
      },

      auditEventCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    return apiOk(data, { correlationId: request.headers.get("x-correlation-id") ?? undefined });
  } catch (err) {
    return apiErr(err, { correlationId: request.headers.get("x-correlation-id") ?? undefined });
  }
}
