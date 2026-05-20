/**
 * GET /api/ai/usage
 *
 * Returns the in-process AI usage summary (bounded buffer, last 500
 * events). The logger NEVER records prompts or secrets — only
 * provider, model, task, latency, status, and error kind — so the
 * envelope is safe to return.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readUsageTail, summarizeUsage } from "@/lib/ai/AIUsageLogger";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const TAIL_DEFAULT = 50;
const TAIL_MAX = 500;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const raw = Number.parseInt(req.nextUrl.searchParams.get("tail") ?? `${TAIL_DEFAULT}`, 10);
    const tail = Number.isFinite(raw) ? Math.max(1, Math.min(raw, TAIL_MAX)) : TAIL_DEFAULT;
    return apiOk({
      summary: summarizeUsage(),
      tail: readUsageTail(tail),
    }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
