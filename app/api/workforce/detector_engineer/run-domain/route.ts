/**
 * POST /api/workforce/detector_engineer/run-domain — Phase 583.
 *
 * Triggers the Detector Engineer's real perception work — walks
 * findings, runs, approvals, and engineer attempts; emits typed
 * signals with confidence labels; persists the report.
 *
 * 303-redirects to /dashboard/workforce/detector_engineer so the
 * operator lands on the engineer detail page where the signal
 * surface renders.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runDetectorEngineer, persistDetectorReport } from "@/lib/workforce/domains/detectorEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `detector_domain_${Date.now().toString(36)}` as CorrelationId;

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let signalCount = 0;
  try {
    const report = await runDetectorEngineer(org);
    outcome = report.outcome;
    signalCount = report.signals.length;
    await persistDetectorReport(org, report);
  } catch (err) {
    console.warn("[detector_engineer/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:detector_engineer",
    correlationId,
    detail: {
      action: "engineer.detector_engineer.run_domain",
      result: outcome,
      signalCount,
    },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/detector_engineer", req.url), 303);
}
