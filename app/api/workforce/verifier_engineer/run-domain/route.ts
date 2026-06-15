/** POST /api/workforce/verifier_engineer/run-domain — Phase 595. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runVerifierEngineer, persistVerifierReport } from "@/lib/workforce/domains/verifierEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `verifier_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let findingCount = 0;
  let failureCalls = 0;
  try {
    const report = await runVerifierEngineer(org);
    outcome = report.outcome;
    findingCount = report.findings.length;
    failureCalls = report.failureCalls;
    await persistVerifierReport(org, report);
  } catch (err) {
    console.warn("[verifier/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:verifier_engineer",
    correlationId,
    detail: { action: "engineer.verifier_engineer.run_domain", result: outcome, findingCount, failureCalls },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/verifier_engineer", req.url), 303);
}
