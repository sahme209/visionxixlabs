/**
 * POST /api/workflows/translate
 *
 * Body: { intent: string }
 *
 * Returns a structured workflow DRAFT (not pinned, not executed). The
 * operator reviews and explicitly pins via a separate UI action.
 * Approval-only-no-execution.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { translateWorkflowIntent } from "@/lib/agents/aiWorkflowTranslator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_INTENT_CHARS = 2000;

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json().catch(() => null)) as { intent?: string } | null;
    if (!body || typeof body.intent !== "string" || body.intent.trim().length === 0) {
      throw AxiomErrors.validation("workflow.intent_required", "Provide a non-empty 'intent'.");
    }
    if (body.intent.length > MAX_INTENT_CHARS) {
      throw AxiomErrors.validation("workflow.intent_too_long", `Intent exceeds ${MAX_INTENT_CHARS} chars.`);
    }
    const result = await translateWorkflowIntent(body.intent);
    return apiOk(result, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}
