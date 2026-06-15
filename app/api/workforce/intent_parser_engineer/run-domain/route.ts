/** POST /api/workforce/intent_parser_engineer/run-domain — Phase 602. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runIntentParserEngineer,
  persistIntentWorkflow,
  INTENT_PARSER_TARGET_KIND,
} from "@/lib/workforce/domains/intentParserEngineer";
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
  const intentText = s(f.get("intentText"));
  if (!title.trim() || !intentText.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/intent_parser_engineer/workflows", req.url), 303);
  }
  const correlationId = `intent_parser_${Date.now().toString(36)}` as CorrelationId;
  let workflow;
  try {
    workflow = await runIntentParserEngineer(org, {
      title,
      intentText,
      knownCapabilities: s(f.get("knownCapabilities")) || undefined,
      hardConstraints: s(f.get("hardConstraints")) || undefined,
    });
    await persistIntentWorkflow(org, workflow);
  } catch (err) {
    console.warn("[intent_parser/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:intent_parser_engineer", correlationId,
      detail: { action: "engineer.intent_parser_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/intent_parser_engineer/workflows", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: workflow.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:intent_parser_engineer", correlationId,
    detail: { action: "engineer.intent_parser_engineer.run_domain", slug: workflow.slug, result: workflow.outcome },
  });
  if (workflow.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${INTENT_PARSER_TARGET_KIND}:${workflow.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/intent_parser_engineer/workflows", req.url), 303);
}
