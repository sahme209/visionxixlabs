/**
 * GET /api/autonomy/policy-previews
 *
 * Returns the PolicyPreviewReport — per-runbook ready-to-paste
 * guardrail policies for AWS / Azure / GCP. Read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildPolicyPreviewReport } from "@/lib/autonomy/policyPreviewGenerator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const raw = req.nextUrl.searchParams.get("lookbackMinutes");
    const lookbackMinutes = raw ? Number.parseInt(raw, 10) : undefined;
    const report = await buildPolicyPreviewReport({
      lookbackMinutes: Number.isFinite(lookbackMinutes) ? lookbackMinutes : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode(report.totalRunbooks > 0 ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
