/** POST /api/workforce/dr_planner_engineer/run-domain — Phase 638. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runDrPlannerEngineer,
  persistDrPlan,
  DR_PLANNER_TARGET_KIND,
} from "@/lib/workforce/domains/drPlannerEngineer";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const topology = s(f.get("topology"));
  const rpoTarget = s(f.get("rpoTarget"));
  const rtoTarget = s(f.get("rtoTarget"));
  if (!title.trim() || !topology.trim() || !rpoTarget.trim() || !rtoTarget.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/dr_planner_engineer/plans", req.url), 303);
  }
  const correlationId = `dr_plan_${Date.now().toString(36)}` as CorrelationId;

  const creditDecision = await checkWorkspaceAICredits(org, 45, { failClosedOnUsageReadError: true });
  if (creditDecision.kind === "block") {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "engineer:dr_planner_engineer",
      correlationId,
      detail: {
        action: "dr_plan_draft",
        reason: creditDecision.reason,
        remainingCents: creditDecision.remainingCents,
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/dr_planner_engineer/plans?blocked=credits_exhausted", req.url),
      303,
    );
  }

  let plan;
  try {
    plan = await runDrPlannerEngineer(org, {
      title,
      topology,
      rpoTarget,
      rtoTarget,
      tier0Services: s(f.get("tier0Services")) || undefined,
      existingBackups: s(f.get("existingBackups")) || undefined,
      complianceContext: s(f.get("complianceContext")) || undefined,
    });
    await persistDrPlan(org, plan);
  } catch (err) {
    console.warn("[dr_planner/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "failure",
      entityRef: "engineer:dr_planner_engineer",
      correlationId,
      detail: { action: "dr_plan_draft", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/dr_planner_engineer/plans", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: plan.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:dr_planner_engineer",
    correlationId,
    detail: {
      action: "dr_plan_draft",
      slug: plan.slug,
      result: plan.outcome,
      verdict: plan.achievabilityVerdict,
      rpo: plan.declaredRpo,
      rto: plan.declaredRto,
      sectionCount: plan.sections.length,
    },
  });
  if (plan.slug) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${DR_PLANNER_TARGET_KIND}:${plan.slug}`)}`, req.url),
      303,
    );
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/dr_planner_engineer/plans", req.url), 303);
}
