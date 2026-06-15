/** POST /api/workforce/meta_reasoner_engineer/run-domain — Phase 599. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runMetaReasonerEngineer,
  persistMetaReasonerReport,
} from "@/lib/workforce/domains/metaReasonerEngineer";
import { triggerDownstreamChain } from "@/lib/workforce/domains/chains";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `meta_reasoner_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let observationCount = 0;
  let snapshotCount = 0;
  let downstreamRan = 0;
  try {
    const report = await runMetaReasonerEngineer(org);
    outcome = report.outcome;
    observationCount = report.observations.length;
    snapshotCount = report.snapshotCount;
    await persistMetaReasonerReport(org, report);
    // Phase 612: cascade to council so the operator gets the verdict
    // packet in the same click. Only fires when meta produced
    // observations worth voting on.
    if (outcome !== "error" && observationCount > 0) {
      const downstream = await triggerDownstreamChain("meta_reasoner_engineer", org);
      downstreamRan = downstream.length;
    }
  } catch (err) {
    console.warn("[meta_reasoner/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:meta_reasoner_engineer",
    correlationId,
    detail: { action: "engineer.meta_reasoner_engineer.run_domain", result: outcome, observationCount, snapshotCount, downstreamRan },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/meta_reasoner_engineer", req.url), 303);
}
