/** POST /api/workforce/council_engineer/run-domain — Phase 600. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runCouncilEngineer, persistCouncilReport } from "@/lib/workforce/domains/councilEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `council_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let decisionCount = 0;
  try {
    const report = await runCouncilEngineer(org);
    outcome = report.outcome;
    decisionCount = report.decisions.length;
    await persistCouncilReport(org, report);
  } catch (err) {
    console.warn("[council/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:council_engineer",
    correlationId,
    detail: { action: "engineer.council_engineer.run_domain", result: outcome, decisionCount },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/council_engineer", req.url), 303);
}
