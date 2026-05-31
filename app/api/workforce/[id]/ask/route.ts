/**
 * POST /api/workforce/[id]/ask — Phase 564.
 *
 * Operator-prompted Q&A against a single engineer. Form-encoded body
 * (so a server-rendered <form> works without client JS):
 *
 *   question = <free text, ≤ 1500 chars>
 *
 * Routes through askEngineer() which persists the answer as an
 * AiRationaleEnrichment row at targetKind="engineer_qa". 303-redirects
 * back to /dashboard/workforce/[id]/ask so the freshly minted answer
 * shows up at the top of the thread.
 *
 * Audits via 'engineer.action_attempted' so the trail captures every
 * Q&A invocation with the operator's actorUserId.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { askEngineer } from "@/lib/workforce/engineerAsk";
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

  const form = await req.formData();
  const question = typeof form.get("question") === "string" ? String(form.get("question")) : "";
  if (!question.trim()) {
    return NextResponse.redirect(new URL(`/dashboard/workforce/${engineer.id}/ask`, req.url), 303);
  }

  const org = String(ctx.organizationId);
  const correlationId = `engineer_qa_${Date.now().toString(36)}` as CorrelationId;
  const result = await askEngineer(engineer, org, question);

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: result.outcome === "error" ? "failure" : "success",
    entityRef: `engineer:${engineer.id}`,
    correlationId,
    detail: {
      action: "engineer.ask",
      engineerId: engineer.id,
      questionLen: result.question.length,
      answerLen: result.answer.length,
      outcome: result.outcome,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/${engineer.id}/ask`, req.url),
    303,
  );
}
