/** POST /api/workforce/safety-preflight/run — Phase 613. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runSafetyPreflight } from "@/lib/workforce/domains/safetyPreflight";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const actionDescription = s(f.get("actionDescription"));
  const currentState = s(f.get("currentState"));
  const riskContext = s(f.get("riskContext"));
  if (!title.trim() || !actionDescription.trim() || !currentState.trim() || !riskContext.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/safety-preflight", req.url), 303);
  }
  const preflightSlug = `${slugify(title) || "preflight"}_${Date.now().toString(36)}`;
  const correlationId = `preflight_${Date.now().toString(36)}` as CorrelationId;

  // Phase 628: gate on workspace AI credit pool before firing the
  // three-engineer composed pre-flight (3 AI calls per click).
  // Estimated cost ~ 30¢ assuming 2k input + 1k output tokens on
  // Sonnet-class — conservative buffer against spam.
  const creditDecision = await checkWorkspaceAICredits(org, 30);
  if (creditDecision.kind === "block") {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "safety-preflight",
      correlationId,
      detail: {
        action: "safety_preflight",
        reason: creditDecision.reason,
        threshold: creditDecision.threshold,
        remainingCents: creditDecision.remainingCents,
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/safety-preflight?blocked=credits_exhausted", req.url),
      303,
    );
  }

  let verdict: string = "review";
  let policyDecision: string | null = null;
  let boundaryTier: string | null = null;
  let approverDecision: string | null = null;
  let errorCount = 0;
  try {
    const result = await runSafetyPreflight(org, {
      preflightSlug,
      title,
      actionDescription,
      currentState,
      riskContext,
      tenantCharter: s(f.get("tenantCharter")) || undefined,
    });
    verdict = result.verdict;
    policyDecision = result.policyDecision;
    boundaryTier = result.boundaryTier;
    approverDecision = result.approverDecision;
    errorCount = result.errors.length;
  } catch (err) {
    console.warn("[safety-preflight/run] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "safety-preflight", correlationId,
      detail: { action: "safety_preflight", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/safety-preflight", req.url), 303);
  }
  // Phase 623: emit a canonical audit-action code that downstream
  // notification consumers can subscribe to without parsing the
  // detail JSON. Maps composed verdict → canonical action:
  //   · block  → engineer.action_blocked     (hard refusal)
  //   · review → engineer.action_requires_approval (gate, operator review)
  //   · allow  → engineer.action_allowed     (safe to advance)
  const auditAction =
    verdict === "block" ? "engineer.action_blocked" :
    verdict === "review" ? "engineer.action_requires_approval" :
    "engineer.action_allowed";
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: auditAction,
    outcome: verdict === "block" ? "blocked" : "success",
    entityRef: "safety-preflight",
    correlationId,
    detail: {
      action: "safety_preflight",
      slug: preflightSlug,
      verdict,
      policyDecision,
      boundaryTier,
      approverDecision,
      errorCount,
    },
  });
  // Land on the approver packet — it's the human-readable summary
  // of the composed verdict that names mustReviewArtifacts.
  return NextResponse.redirect(
    new URL(`/dashboard/agi-memory/${encodeURIComponent(`engineer_approval_packet:${preflightSlug}__approver`)}`, req.url),
    303,
  );
}
