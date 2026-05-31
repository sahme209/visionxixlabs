/**
 * POST /api/workforce/[id]/run-agi — Phase 557.
 *
 * Triggers the engineer's own AGI flow. Builds a role-aware Claude
 * prompt, runs it through the canonical instrumented fetcher
 * (circuit breaker + AiCallLog), parses the structured response, and
 * upserts an AiRationaleEnrichment row at
 *   targetKind="engineer_specialty"
 *   targetId=<engineer.id>
 *
 * Audited via 'engineer.action_attempted' so the run shows up in the
 * audit trail with the operator's actorUserId.
 *
 * 303-redirect back to the engineer detail page so the operator sees
 * the freshly generated rationale on the next render.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { runEngineerAgi, persistEngineerAgiResult } from "@/lib/workforce/engineerAgi";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireContext();
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") {
    return NextResponse.json({ error: "engineer not found" }, { status: 404 });
  }

  const org = String(ctx.organizationId);
  const correlationId = `engineer_agi_${Date.now().toString(36)}` as CorrelationId;

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  try {
    const result = await runEngineerAgi(engineer, org);
    outcome = result.outcome;
    await persistEngineerAgiResult(engineer, org, result);
  } catch (err) {
    // Defensive — runEngineerAgi already absorbs errors into the
    // fallback path, so we should never get here. If we do, audit
    // honestly and 303 back so the surface remains usable.
    console.warn("[run-agi] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: `engineer:${engineer.id}`,
    correlationId,
    detail: {
      action: "engineer.run_agi",
      engineerId: engineer.id,
      department: engineer.department,
      result: outcome,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/${engineer.id}`, req.url),
    303,
  );
}
