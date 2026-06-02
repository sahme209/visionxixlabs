/**
 * POST /api/workforce/compliance_engineer/run-domain — Phase 582.
 *
 * Triggers the compliance engineer's actual domain work: walks the
 * canonical control catalog, scores each against the workspace's
 * findings, asks Claude for auditor-grade narrative, persists the
 * typed report.
 *
 * 303-redirects to /dashboard/compliance so the operator sees the
 * fresh report inline with the existing scorecard.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runComplianceEngineer, persistComplianceReport } from "@/lib/workforce/domains/complianceEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `compliance_domain_${Date.now().toString(36)}` as CorrelationId;

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  try {
    const report = await runComplianceEngineer(org);
    outcome = report.outcome;
    await persistComplianceReport(org, report);
  } catch (err) {
    console.warn("[compliance_engineer/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:compliance_engineer",
    correlationId,
    detail: {
      action: "engineer.compliance_engineer.run_domain",
      result: outcome,
    },
  });

  return NextResponse.redirect(new URL("/dashboard/compliance", req.url), 303);
}
