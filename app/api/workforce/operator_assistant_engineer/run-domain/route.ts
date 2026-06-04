/** POST /api/workforce/operator_assistant_engineer/run-domain — Phase 607. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runOperatorAssistantEngineer,
  persistOperatorAssistantReply,
  OPERATOR_ASSISTANT_TARGET_KIND,
} from "@/lib/workforce/domains/operatorAssistantEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const prompt = s(f.get("prompt"));
  if (!title.trim() || !prompt.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/operator_assistant_engineer/replies", req.url), 303);
  }
  const correlationId = `operator_copilot_${Date.now().toString(36)}` as CorrelationId;
  let reply;
  try {
    reply = await runOperatorAssistantEngineer(org, {
      title,
      prompt,
      workspaceContext: s(f.get("workspaceContext")) || undefined,
      conversationHistory: s(f.get("conversationHistory")) || undefined,
    });
    await persistOperatorAssistantReply(org, reply);
  } catch (err) {
    console.warn("[operator_assistant/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:operator_assistant_engineer", correlationId,
      detail: { action: "engineer.operator_assistant_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/operator_assistant_engineer/replies", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: reply.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:operator_assistant_engineer", correlationId,
    detail: { action: "engineer.operator_assistant_engineer.run_domain", slug: reply.slug, result: reply.outcome, intent: reply.intent, confidence: reply.confidence },
  });
  if (reply.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${OPERATOR_ASSISTANT_TARGET_KIND}:${reply.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/operator_assistant_engineer/replies", req.url), 303);
}
