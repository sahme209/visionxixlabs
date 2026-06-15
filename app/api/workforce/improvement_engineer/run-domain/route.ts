/** POST /api/workforce/improvement_engineer/run-domain — Phase 603. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runImprovementEngineer, persistImprovementReport } from "@/lib/workforce/domains/improvementEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `improvement_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let proposalCount = 0;
  try {
    const report = await runImprovementEngineer(org);
    outcome = report.outcome;
    proposalCount = report.proposals.length;
    await persistImprovementReport(org, report);
  } catch (err) {
    console.warn("[improvement/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:improvement_engineer",
    correlationId,
    detail: { action: "engineer.improvement_engineer.run_domain", result: outcome, proposalCount },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/improvement_engineer", req.url), 303);
}
