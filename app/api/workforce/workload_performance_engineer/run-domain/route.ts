/** POST /api/workforce/workload_performance_engineer/run-domain — Phase 640. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runWorkloadPerformanceEngineer,
  persistWorkloadPerformanceAnalysis,
  WORKLOAD_PERFORMANCE_TARGET_KIND,
} from "@/lib/workforce/domains/workloadPerformanceEngineer";
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
  const serviceDescription = s(f.get("serviceDescription"));
  const telemetrySnapshot = s(f.get("telemetrySnapshot"));
  if (!title.trim() || !serviceDescription.trim() || !telemetrySnapshot.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/workload_performance_engineer/analyses", req.url), 303);
  }
  const correlationId = `workload_perf_${Date.now().toString(36)}` as CorrelationId;

  let creditDecision;
  try {
    creditDecision = await checkWorkspaceAICredits(org, 30, { failClosedOnUsageReadError: true });
  } catch (err) {
    // Fail closed, not crash: a transient usage-read failure must not
    // surface as an uncaught 500 — degrade to the same blocked response
    // the route already gives for an exhausted credit pool.
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "engineer:workload_performance_engineer",
      correlationId,
      detail: {
        action: "workload_performance_analysis",
        reason: "credit_meter_unavailable",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/workload_performance_engineer/analyses?blocked=credits_exhausted", req.url),
      303,
    );
  }
  if (creditDecision.kind === "block") {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "engineer:workload_performance_engineer",
      correlationId,
      detail: {
        action: "workload_performance_analysis",
        reason: creditDecision.reason,
        remainingCents: creditDecision.remainingCents,
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/workload_performance_engineer/analyses?blocked=credits_exhausted", req.url),
      303,
    );
  }

  let analysis;
  try {
    analysis = await runWorkloadPerformanceEngineer(org, {
      title,
      serviceDescription,
      telemetrySnapshot,
      baselineExpectations: s(f.get("baselineExpectations")) || undefined,
      recentChanges: s(f.get("recentChanges")) || undefined,
    });
    await persistWorkloadPerformanceAnalysis(org, analysis);
  } catch (err) {
    console.warn(
      "[workload_performance/run-domain] hard failure:",
      err instanceof Error ? err.message : err,
    );
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "failure",
      entityRef: "engineer:workload_performance_engineer",
      correlationId,
      detail: { action: "workload_performance_analysis", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/workload_performance_engineer/analyses", req.url),
      303,
    );
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: analysis.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:workload_performance_engineer",
    correlationId,
    detail: {
      action: "workload_performance_analysis",
      slug: analysis.slug,
      result: analysis.outcome,
      verdict: analysis.performanceVerdict,
      deviationCount: analysis.baselineDeviations.length,
      hypothesisCount: analysis.rootCauseHypotheses.length,
    },
  });
  if (analysis.slug) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${WORKLOAD_PERFORMANCE_TARGET_KIND}:${analysis.slug}`)}`, req.url),
      303,
    );
  }
  return NextResponse.redirect(
    new URL("/dashboard/workforce/workload_performance_engineer/analyses", req.url),
    303,
  );
}
