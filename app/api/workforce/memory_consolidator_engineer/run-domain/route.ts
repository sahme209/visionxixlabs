/** POST /api/workforce/memory_consolidator_engineer/run-domain — Phase 598. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runMemoryConsolidatorEngineer,
  persistMemoryConsolidationReport,
} from "@/lib/workforce/domains/memoryConsolidatorEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `memory_consolidator_domain_${Date.now().toString(36)}` as CorrelationId;
  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let kindCount = 0;
  let totalRows = 0;
  try {
    const report = await runMemoryConsolidatorEngineer(org);
    outcome = report.outcome;
    kindCount = report.kindStats.length;
    totalRows = report.totalRows;
    await persistMemoryConsolidationReport(org, report);
  } catch (err) {
    console.warn("[memory_consolidator/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:memory_consolidator_engineer",
    correlationId,
    detail: { action: "engineer.memory_consolidator_engineer.run_domain", result: outcome, kindCount, totalRows },
  });
  return NextResponse.redirect(new URL("/dashboard/workforce/memory_consolidator_engineer", req.url), 303);
}
