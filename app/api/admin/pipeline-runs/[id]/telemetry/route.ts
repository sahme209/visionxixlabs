/**
 * GET /api/admin/pipeline-runs/[id]/telemetry — Phase 400.
 *
 * Returns the per-stage cost + token + latency breakdown for a pipeline
 * run, plus the run-level rollup computed by the pure
 * `rollupStageTelemetry` kernel.
 *
 * Useful for:
 *   - "which stage burned all my budget?" debug
 *   - per-pipeline cost trend (call this for every recent run)
 *   - billing reconciliation (cross-check vs. AI provider invoice)
 *
 * Numeric cost fields and hasCost are recorded stage projections, not final
 * provider totals or ledger allowance. costState/finalCostCents (and run
 * finalTotalCostCents) explicitly describe projection completeness.
 * Gated by ADMIN_EMAILS.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import {
  rollupStageTelemetry,
  classifyStageCost,
  type FinancialCostMarker,
  type StageTelemetryRow,
} from "@/lib/workforce/pipelines/rollupStageTelemetry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const { id: runId } = await context.params;

  const {run, markers} = await prisma.$transaction(async tx => {
  const run = await tx.pipelineRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      organizationId: true,
      pipelineId: true,
      status: true,
      triggeredBy: true,
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
          costCents: true,
          tokensInput: true,
          tokensOutput: true,
          latencyMs: true,
          completedAt: true,
          errorMessage: true,
        },
      },
    },
  });
  const markers = run ? await tx.$queryRawUnsafe<FinancialCostMarker[]>(
    `SELECT id, jsonb_typeof("outputDetail"->'cost') AS "costShape", "outputDetail"->'cost'->'totalCents' AS "totalCents", "outputDetail"->'cost'->'pendingSettlement' AS "pendingSettlement" FROM "PipelineStageRun" WHERE "runId"=$1`, run.id,
  ) : [];
  return {run, markers};
  }, {isolationLevel: "RepeatableRead"});

  if (!run) {
    return NextResponse.json({ ok: false, reason: "run_not_found" }, { status: 404 });
  }

  const financial = new Map(markers.map(marker => [marker.id, marker]));
  const rows: StageTelemetryRow[] = run.stages.map((s) => ({
    ...classifyStageCost(s, financial.get(s.id)),
    stageId: s.stageId,
    stageKind: s.stageKind,
    status: s.status,
    ordering: s.ordering,
    costCents: s.costCents,
    tokensInput: s.tokensInput,
    tokensOutput: s.tokensOutput,
    latencyMs: s.latencyMs,
  }));

  const rollup = rollupStageTelemetry(rows, {runStatus: run.status});

  return NextResponse.json({
    ok: true,
    run: {
      id: run.id,
      organizationId: run.organizationId,
      pipelineId: run.pipelineId,
      status: run.status,
      triggeredBy: run.triggeredBy,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      errorSummary: run.errorSummary,
    },
    rollup,
    stages: run.stages.map((s, index) => ({
      costState: rows[index].costState,
      finalCostCents: rows[index].finalCostCents,
      id: s.id,
      stageId: s.stageId,
      stageKind: s.stageKind,
      ordering: s.ordering,
      status: s.status,
      costCents: s.costCents,
      tokensInput: s.tokensInput,
      tokensOutput: s.tokensOutput,
      latencyMs: s.latencyMs,
      completedAt: s.completedAt,
      errorMessage: s.errorMessage,
    })),
  });
}
