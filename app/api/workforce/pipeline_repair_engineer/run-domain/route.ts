/** POST /api/workforce/pipeline_repair_engineer/run-domain — Phase 596. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runPipelineRepairEngineer, persistPipelineRepairReport } from "@/lib/workforce/domains/pipelineRepairEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `pipeline_repair_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let entryCount = 0;
  let totalFailures = 0;
  try {
    const report = await runPipelineRepairEngineer(org);
    outcome = report.outcome;
    entryCount = report.entries.length;
    totalFailures = report.totalFailures;
    await persistPipelineRepairReport(org, report);
  } catch (err) {
    console.warn("[pipeline_repair/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:pipeline_repair_engineer",
    correlationId,
    detail: { action: "engineer.pipeline_repair_engineer.run_domain", result: outcome, entryCount, totalFailures },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/pipeline_repair_engineer", req.url), 303);
}
