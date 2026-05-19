/**
 * POST /api/autonomy/scp-simulate
 *
 * Local SCP / IAM policy simulator. Body shape:
 *   {
 *     policyJson: string,
 *     request: SimulationRequest
 *   }
 *
 * Pure local evaluation — no AWS SDK call. Returns SimulationResult
 * with verdict, summary, and per-statement matches.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { simulateScp, type SimulationRequest } from "@/lib/autonomy/scpSimulator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const body = (await req.json()) as { policyJson?: string; request?: SimulationRequest } | null;
    if (!body?.policyJson || !body.request?.action) {
      throw AxiomErrors.validation("simulate.required", "Body must include policyJson + request.action.");
    }
    const result = simulateScp(body.policyJson, body.request);
    return apiOk(result, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
