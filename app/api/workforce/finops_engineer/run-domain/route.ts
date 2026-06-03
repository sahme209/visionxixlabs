/** POST /api/workforce/finops_engineer/run-domain — Phase 587. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runFinopsEngineer, persistFinopsReport } from "@/lib/workforce/domains/finopsEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `finops_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let candidateCount = 0;
  let monthlyHigh = 0;
  try {
    const report = await runFinopsEngineer(org);
    outcome = report.outcome;
    candidateCount = report.totals.candidateCount;
    monthlyHigh = report.totals.monthlyHighUsd;
    await persistFinopsReport(org, report);
  } catch (err) {
    console.warn("[finops/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:finops_engineer",
    correlationId,
    detail: { action: "engineer.finops_engineer.run_domain", result: outcome, candidateCount, monthlyHighUsd: monthlyHigh },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/finops_engineer", req.url), 303);
}
