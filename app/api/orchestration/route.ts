/**
 * GET /api/orchestration
 *
 * Returns the list of active orchestrations Axiom is aware of. Today
 * the orchestrations are derived from the remediation pipeline +
 * security approval orchestrator + release approval orchestrator (no
 * persistence yet). Auth-gated.
 */

import { NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { listApprovals } from "@/lib/approvals/approvalEngine";
import { listActiveLocks } from "@/lib/execution/executionLocks";
import {
  type ExecutionOrchestration,
  defaultStatusForStage,
  newOrchestrationId,
} from "@/lib/execution/orchestrationModel";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;
    const pipeline = await runRemediationPipeline();

    // Derive one orchestration per remediation bundle.
    const orchestrations: ExecutionOrchestration[] = pipeline.bundles.map((bundle) => {
      const stage = bundle.finalStatus === "approved" ? "approved"
        : bundle.finalStatus === "requires_approval"  ? "approval_requested"
        : bundle.finalStatus === "blocked_by_policy"  ? "execution_blocked"
        : bundle.finalStatus === "ready_for_review"   ? "simulated"
        : bundle.finalStatus === "ready_for_desktop"  ? "desktop_review_ready"
        : bundle.finalStatus === "plan_generated"     ? "planned"
        : bundle.finalStatus === "needs_validation"   ? "planned"
        : "identified";
      return {
        id: newOrchestrationId(bundle.candidate.id),
        tenantId,
        provider: bundle.candidate.provider,
        sourceFindingId: bundle.candidate.sourceFindingId,
        stage,
        status: defaultStatusForStage(stage),
        riskLevel: bundle.candidate.riskLevel,
        sourceMode: bundle.candidate.sourceMode,
        title: bundle.candidate.title,
        description: bundle.candidate.description,
        references: {
          remediationCandidateId: bundle.candidate.id,
          changeSetId: `cs.${bundle.candidate.id}`,
          simulationId: undefined,
          approvalRequestId: undefined,
          policyDecisionId: bundle.candidate.policyDecision,
          desktopHandoffId: undefined,
          workflowId: undefined,
          auditEventIds: [],
          traceIds: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        evidenceRefs: bundle.candidate.evidence.map((e) => ({ label: e.label, ref: e.ref })),
        safeNextAction: bundle.readiness.safeNextAction,
      };
    });

    const approvals = listApprovals({ tenantId });
    const locks = listActiveLocks({ tenantId });

    return NextResponse.json(apiSuccess({
      generatedAt: new Date().toISOString(),
      orchestrations,
      approvals,
      activeLocks: locks,
      summary: {
        total: orchestrations.length,
        approvalRequested: orchestrations.filter((o) => o.stage === "approval_requested").length,
        blocked:            orchestrations.filter((o) => o.stage === "execution_blocked").length,
        desktopReviewReady: orchestrations.filter((o) => o.stage === "desktop_review_ready").length,
      },
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET():  Promise<NextResponse> { return handle(); }
export async function POST(): Promise<NextResponse> { return handle(); }
