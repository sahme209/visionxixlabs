/**
 * GET /api/v1/pipelines/runs/[id] — Phase 396.
 *
 * Public read endpoint for a pipeline run's current status. Scoped
 * to the API key's organization (no cross-tenant leak).
 *
 * Required scope: pipeline:read.
 *
 * Response shape:
 *   {
 *     ok: true,
 *     run: {
 *       id, pipelineId, status, triggeredBy, correlationId,
 *       startedAt, completedAt, errorSummary,
 *       stages: [ { id, kind, ordering, status, completedAt, errorMessage } ]
 *     }
 *   }
 *
 * 404 when the runId doesn't exist OR belongs to a different
 * workspace — we collapse both to "run_not_found" so attackers
 * can't probe for cross-tenant run IDs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = `v1_pipeline_get_${Date.now().toString(36)}`;
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/pipelines/runs/[id]",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}),
        ...(typeof auth.retryAfterSeconds === "number" ? { retryAfterSeconds: auth.retryAfterSeconds } : {}),
      },
      { status: auth.httpStatus, headers },
    );
  }

  const { id } = await context.params;

  const run = await prisma.pipelineRun.findFirst({
    where: { id, organizationId: auth.organizationId },
    select: {
      id: true,
      pipelineId: true,
      status: true,
      triggeredBy: true,
      correlationId: true,
      startedAt: true,
      completedAt: true,
      errorSummary: true,
      stages: {
        orderBy: { ordering: "asc" },
        select: {
          id: true,
          stageId: true,
          stageKind: true,
          ordering: true,
          status: true,
          completedAt: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, run });
}
