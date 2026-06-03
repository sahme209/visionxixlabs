/** POST /api/workforce/auditor_engineer/run-domain — Phase 589. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runAuditorEngineer, persistAuditorReport } from "@/lib/workforce/domains/auditorEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `auditor_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let observationCount = 0;
  let totalEvents = 0;
  try {
    const report = await runAuditorEngineer(org);
    outcome = report.outcome;
    observationCount = report.observations.length;
    totalEvents = report.totalAuditEvents;
    await persistAuditorReport(org, report);
  } catch (err) {
    console.warn("[auditor/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:auditor_engineer",
    correlationId,
    detail: { action: "engineer.auditor_engineer.run_domain", result: outcome, observationCount, totalEvents },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/auditor_engineer", req.url), 303);
}
