/** POST /api/workforce/anomaly_engineer/run-domain — Phase 588. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runAnomalyEngineer, persistAnomalyReport } from "@/lib/workforce/domains/anomalyEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `anomaly_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let noticeCount = 0;
  try {
    const report = await runAnomalyEngineer(org);
    outcome = report.outcome;
    noticeCount = report.notices.length;
    await persistAnomalyReport(org, report);
  } catch (err) {
    console.warn("[anomaly/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:anomaly_engineer",
    correlationId,
    detail: { action: "engineer.anomaly_engineer.run_domain", result: outcome, noticeCount },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/anomaly_engineer", req.url), 303);
}
