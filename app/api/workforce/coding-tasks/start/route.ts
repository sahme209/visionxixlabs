/**
 * POST /api/workforce/coding-tasks/start — Phase 379.
 *
 * Creates a CodingTask + kicks off the ai_coding pipeline. The
 * runner advances synchronously through dry-run coding executors
 * until it hits the PR-approval gate, then pauses. Operator votes
 * via the existing two-step quorum; on approval the run resumes
 * and "opens" the PR (dry-run for now).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { startPipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";
import { parseCodingTaskBody } from "@/lib/workforce/pipelines/parseCodingTaskBody";
import { registerCodingDryRunExecutors } from "@/lib/workforce/pipelines/codingDryRunExecutors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }

  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty */ }
  const parsed = parseCodingTaskBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, reason: parsed.reason, detail: parsed.detail }, { status: 400 });
  }

  registerCodingDryRunExecutors();

  const orgId = String(session.organizationId);
  const triggeredBy = session.userId ?? session.email ?? "unknown";

  const runResult = await startPipelineRun({
    organizationId: orgId,
    pipelineId: "ai_coding",
    triggeredBy,
    metadata: {
      instruction: parsed.input.instruction,
      repoRef: parsed.input.repoRef,
      branchHint: parsed.input.branchHint,
    },
  });

  if (!runResult.ok) {
    return NextResponse.json({ ok: false, reason: runResult.reason }, { status: 500 });
  }

  // Bind a CodingTask row to the run so the operator surface has a
  // first-class home for the instruction + repo target. Best-effort:
  // if the row write fails the run is already in flight and audited;
  // operator just won't see it in /dashboard/workforce/coding.
  let codingTaskId: string | null = null;
  try {
    const task = await prisma.codingTask.create({
      data: {
        organizationId: orgId,
        runId: runResult.runId,
        instruction: parsed.input.instruction,
        repoRef: parsed.input.repoRef,
        branchHint: parsed.input.branchHint,
        createdBy: triggeredBy,
        correlationId: runResult.correlationId,
        status: "running",
      },
    });
    codingTaskId = task.id;
  } catch {
    // Soft-fail — the pipeline run is the source of truth.
  }

  return NextResponse.json({
    ok: true,
    codingTaskId,
    runId: runResult.runId,
    correlationId: runResult.correlationId,
  });
}
