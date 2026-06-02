/**
 * POST /api/workforce/secrets_hygiene_engineer/run-domain — Phase 586.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runSecretsHygieneEngineer, persistSecretsHygieneReport } from "@/lib/workforce/domains/secretsHygieneEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `secrets_domain_${Date.now().toString(36)}` as CorrelationId;

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let candidateCount = 0;
  try {
    const report = await runSecretsHygieneEngineer(org);
    outcome = report.outcome;
    candidateCount = report.candidatesTotal;
    await persistSecretsHygieneReport(org, report);
  } catch (err) {
    console.warn("[secrets_hygiene/run-domain] hard failure:", err instanceof Error ? err.message : err);
    outcome = "error";
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: "engineer:secrets_hygiene_engineer",
    correlationId,
    detail: { action: "engineer.secrets_hygiene_engineer.run_domain", result: outcome, candidateCount },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/secrets_hygiene_engineer", req.url), 303);
}
