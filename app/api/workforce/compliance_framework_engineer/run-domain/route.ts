/** POST /api/workforce/compliance_framework_engineer/run-domain — Phase 636. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runComplianceFrameworkEngineer,
  persistComplianceFrameworkAssessment,
  COMPLIANCE_FRAMEWORK_TARGET_KIND,
  type ComplianceFramework,
} from "@/lib/workforce/domains/complianceFrameworkEngineer";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parseFramework(raw: string): ComplianceFramework {
  if (
    raw === "soc2" || raw === "iso27001" || raw === "hipaa" ||
    raw === "pci_dss" || raw === "nist_800_53" || raw === "cis_benchmark"
  ) return raw;
  return "soc2";
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const framework = parseFramework(s(f.get("framework")));
  const cloudPosture = s(f.get("cloudPosture"));
  if (!title.trim() || !cloudPosture.trim()) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/compliance_framework_engineer/assessments", req.url),
      303,
    );
  }
  const correlationId = `compliance_framework_${Date.now().toString(36)}` as CorrelationId;

  // Phase 628: gate on AI credit pool. Assessment uses maxTokens=4000
  // — estimate ~40¢ on Sonnet-class with conservative buffer.
  const creditDecision = await checkWorkspaceAICredits(org, 40);
  if (creditDecision.kind === "block") {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "billing.entitlement_blocked",
      outcome: "blocked",
      entityRef: "engineer:compliance_framework_engineer",
      correlationId,
      detail: {
        action: "compliance_framework_assessment",
        framework,
        reason: creditDecision.reason,
        remainingCents: creditDecision.remainingCents,
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/compliance_framework_engineer/assessments?blocked=credits_exhausted", req.url),
      303,
    );
  }

  let assessment;
  try {
    assessment = await runComplianceFrameworkEngineer(org, {
      title,
      framework,
      cloudPosture,
      auditContext: s(f.get("auditContext")) || undefined,
      inScopeControls: s(f.get("inScopeControls")) || undefined,
    });
    await persistComplianceFrameworkAssessment(org, assessment);
  } catch (err) {
    console.warn(
      "[compliance_framework/run-domain] hard failure:",
      err instanceof Error ? err.message : err,
    );
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "failure",
      entityRef: "engineer:compliance_framework_engineer",
      correlationId,
      detail: {
        action: "compliance_framework_assessment",
        framework,
        error: err instanceof Error ? err.message : "unknown",
      },
    });
    return NextResponse.redirect(
      new URL("/dashboard/workforce/compliance_framework_engineer/assessments", req.url),
      303,
    );
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: assessment.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:compliance_framework_engineer",
    correlationId,
    detail: {
      action: "compliance_framework_assessment",
      framework: assessment.framework,
      slug: assessment.slug,
      result: assessment.outcome,
      overallScore: assessment.overallScore,
      controlCount: assessment.controlAssessments.length,
      gapCount: assessment.prioritizedGaps.length,
    },
  });
  if (assessment.slug) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${COMPLIANCE_FRAMEWORK_TARGET_KIND}:${assessment.slug}`)}`, req.url),
      303,
    );
  }
  return NextResponse.redirect(
    new URL("/dashboard/workforce/compliance_framework_engineer/assessments", req.url),
    303,
  );
}
