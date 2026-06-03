/** POST /api/workforce/refactor_engineer/run-domain — Phase 591. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runRefactorEngineer, persistRefactorPlan, REFACTOR_TARGET_KIND } from "@/lib/workforce/domains/refactorEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title")); const sourceCode = s(f.get("sourceCode")); const refactorGoal = s(f.get("refactorGoal"));
  if (!title.trim() || !sourceCode.trim() || !refactorGoal.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/refactor_engineer/plans", req.url), 303);
  }
  const correlationId = `refactor_${Date.now().toString(36)}` as CorrelationId;
  let plan;
  try {
    plan = await runRefactorEngineer(org, {
      title, sourceCode, refactorGoal,
      smellsToAddress: s(f.get("smellsToAddress")) || undefined,
      language: s(f.get("language")) || undefined,
    });
    await persistRefactorPlan(org, plan);
  } catch (err) {
    console.warn("[refactor/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:refactor_engineer", correlationId,
      detail: { action: "engineer.refactor_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/refactor_engineer/plans", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: plan.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:refactor_engineer", correlationId,
    detail: { action: "engineer.refactor_engineer.run_domain", slug: plan.slug, result: plan.outcome },
  });
  if (plan.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${REFACTOR_TARGET_KIND}:${plan.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/refactor_engineer/plans", req.url), 303);
}
