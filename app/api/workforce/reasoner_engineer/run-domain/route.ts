/** POST /api/workforce/reasoner_engineer/run-domain — Phase 604. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runReasonerEngineer, persistReasonerHypothesis, REASONER_TARGET_KIND } from "@/lib/workforce/domains/reasonerEngineer";
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
  const observations = s(f.get("observations"));
  if (!title.trim() || !observations.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/reasoner_engineer/hypotheses", req.url), 303);
  }
  const correlationId = `reasoner_${Date.now().toString(36)}` as CorrelationId;
  let hypothesis;
  try {
    hypothesis = await runReasonerEngineer(org, {
      title,
      observations,
      domainContext: s(f.get("domainContext")) || undefined,
      alreadyRuledOut: s(f.get("alreadyRuledOut")) || undefined,
    });
    await persistReasonerHypothesis(org, hypothesis);
  } catch (err) {
    console.warn("[reasoner/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:reasoner_engineer", correlationId,
      detail: { action: "engineer.reasoner_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/reasoner_engineer/hypotheses", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: hypothesis.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:reasoner_engineer", correlationId,
    detail: { action: "engineer.reasoner_engineer.run_domain", slug: hypothesis.slug, result: hypothesis.outcome, confidence: hypothesis.confidence },
  });
  if (hypothesis.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${REASONER_TARGET_KIND}:${hypothesis.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/reasoner_engineer/hypotheses", req.url), 303);
}
