/**
 * POST /api/workflows/translate
 *
 * Body: { intent: string }
 *
 * Returns a structured workflow DRAFT (not pinned, not executed). The
 * operator reviews and explicitly pins via a separate UI action.
 * Approval-only-no-execution.
 */

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { translateWorkflowIntent } from "@/lib/agents/aiWorkflowTranslator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_INTENT_CHARS = 2000;

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    if (!isSameOriginRequest(req)) {
      return apiErr(AxiomErrors.policy("workflow.invalid_origin", "Open Workflow translator in your workspace to draft a workflow."), {
        correlationId, status: 403, safetyContract: "approval_only_no_execution",
      });
    }
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json().catch(() => null)) as { intent?: string } | null;
    if (!body || typeof body.intent !== "string" || body.intent.trim().length === 0) {
      throw AxiomErrors.validation("workflow.intent_required", "Provide a non-empty 'intent'.");
    }
    if (body.intent.length > MAX_INTENT_CHARS) {
      throw AxiomErrors.validation("workflow.intent_too_long", `Intent exceeds ${MAX_INTENT_CHARS} chars.`);
    }
    const requestKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{16,160}$/.test(requestKey)) {
      throw AxiomErrors.validation("workflow.request_key_required", "A stable request key is required to draft a workflow.");
    }
    const userId = String(ctx.userId);
    const organizationId = String(ctx.organizationId);
    const digest = createHash("sha256").update(JSON.stringify([userId, requestKey])).digest("hex");
    const result = await translateWorkflowIntent(body.intent, {
      organizationId, userId, correlationId, idempotencyKey: `workflow_translator_${digest}`,
    });
    return apiOk(result, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}
