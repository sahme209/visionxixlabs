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
import { enforceEntitlement } from "@/lib/billing/enforceEntitlement";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

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

  // Phase 384 — entitlement gate. Each coding task counts as an agent
  // run for plan limit purposes. Hard-block when the workspace has hit
  // its monthly cap; soft thresholds (70%, 90%) pass through and surface
  // in the response detail for the client to render warnings.
  const entitlement = await enforceEntitlement({
    organizationId: orgId,
    dimension: "agent_runs_per_month",
    attemptedDelta: 1,
  });
  if (entitlement.kind === "block") {
    try {
      await recordAudit({
        organizationId: idFactory.organization(orgId),
        actorUserId: session.userId ? session.userId : idFactory.user(session.email ?? "unknown"),
        actorKind: "user",
        action: "billing.entitlement_blocked",
        outcome: "blocked",
        entityRef: `entitlement:${entitlement.dimension}`,
        correlationId: idFactory.correlation(`entitlement_block_${Date.now().toString(36)}`),
        source: "live",
        detail: {
          dimension: entitlement.dimension,
          threshold: entitlement.threshold,
          limit: entitlement.limit,
        },
      });
    } catch { /* best-effort */ }
    return NextResponse.json({
      ok: false,
      reason: "entitlement_exhausted",
      detail: `Monthly agent-run quota reached for your plan (limit ${entitlement.limit}). Upgrade to keep running.`,
      dimension: entitlement.dimension,
      threshold: entitlement.threshold,
      limit: entitlement.limit,
    }, { status: 402 });   // 402 Payment Required — fits "your plan needs more"
  }

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

  // Phase 384 — emit an `agent_run` UsageEvent so the entitlement counter
  // increments per task. Cost is 0 here — the real AI cost lands later
  // via Phase 382's recordAIUsageEvent when code_propose actually fires.
  try {
    await prisma.usageEvent.create({
      data: {
        organizationId: orgId,
        eventKind: "agent_run",
        provider: null,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        cachedReadTokens: 0,
        costCents: 0,
        triggeredBy,
        correlationId: runResult.correlationId,
        metadata: {
          taskKind: "ai_coding",
          codingTaskId,
          runId: runResult.runId,
        },
      },
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    ok: true,
    codingTaskId,
    runId: runResult.runId,
    correlationId: runResult.correlationId,
    entitlement: {
      dimension: entitlement.dimension,
      threshold: entitlement.threshold,
      remaining: entitlement.remaining === Number.POSITIVE_INFINITY ? null : entitlement.remaining,
      limit: entitlement.limit,
    },
  });
}
