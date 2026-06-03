/** POST /api/workforce/workflow_orchestrator_engineer/run-domain — Phase 606. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runWorkflowOrchestratorEngineer,
  persistWorkflowPlan,
  WORKFLOW_ORCHESTRATOR_TARGET_KIND,
  type ApprovalPolicy,
} from "@/lib/workforce/domains/workflowOrchestratorEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parseApprovalPolicy(raw: string): ApprovalPolicy {
  return raw === "auto" || raw === "terminal" || raw === "per_step" ? raw : "per_step";
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const workflowSpec = s(f.get("workflowSpec"));
  if (!title.trim() || !workflowSpec.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/workflow_orchestrator_engineer/plans", req.url), 303);
  }
  const correlationId = `workflow_orch_${Date.now().toString(36)}` as CorrelationId;
  let plan;
  try {
    plan = await runWorkflowOrchestratorEngineer(org, {
      title,
      workflowSpec,
      approvalPolicy: parseApprovalPolicy(s(f.get("approvalPolicy"))),
      guardrailRequirements: s(f.get("guardrailRequirements")) || undefined,
    });
    await persistWorkflowPlan(org, plan);
  } catch (err) {
    console.warn("[workflow_orchestrator/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:workflow_orchestrator_engineer", correlationId,
      detail: { action: "engineer.workflow_orchestrator_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/workflow_orchestrator_engineer/plans", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: plan.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:workflow_orchestrator_engineer", correlationId,
    detail: { action: "engineer.workflow_orchestrator_engineer.run_domain", slug: plan.slug, result: plan.outcome, stepCount: plan.steps.length },
  });
  if (plan.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${WORKFLOW_ORCHESTRATOR_TARGET_KIND}:${plan.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/workflow_orchestrator_engineer/plans", req.url), 303);
}
