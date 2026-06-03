/** POST /api/workforce/alert_noise_engineer/run-domain — Phase 594. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runAlertNoiseEngineer, persistAlertNoiseReport } from "@/lib/workforce/domains/alertNoiseEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `alert_noise_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let classificationCount = 0;
  let totalAlerts = 0;
  try {
    const report = await runAlertNoiseEngineer(org);
    outcome = report.outcome;
    classificationCount = report.classifications.length;
    totalAlerts = report.totalAlerts;
    await persistAlertNoiseReport(org, report);
  } catch (err) {
    console.warn("[alert_noise/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:alert_noise_engineer",
    correlationId,
    detail: { action: "engineer.alert_noise_engineer.run_domain", result: outcome, classificationCount, totalAlerts },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/alert_noise_engineer", req.url), 303);
}
