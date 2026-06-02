/**
 * POST /api/workforce/incident_engineer/run-domain — Phase 585.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runIncidentEngineer, persistIncidentReport } from "@/lib/workforce/domains/incidentEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `incident_domain_${Date.now().toString(36)}` as CorrelationId;

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let triagedCount = 0;
  try {
    const report = await runIncidentEngineer(org);
    outcome = report.outcome;
    triagedCount = report.topIncidents.length;
    await persistIncidentReport(org, report);
  } catch (err) {
    console.warn("[incident_engineer/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:incident_engineer",
    correlationId,
    detail: { action: "engineer.incident_engineer.run_domain", result: outcome, triagedCount },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/incident_engineer", req.url), 303);
}
