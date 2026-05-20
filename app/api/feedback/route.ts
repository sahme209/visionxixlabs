/**
 * POST /api/feedback
 *
 * In-product feedback capture. Body shape:
 *   { sentiment: "happy" | "neutral" | "frustrated",
 *     message: string,
 *     pagePath?: string }
 *
 * Anonymous-allowed: works without auth context (we still attribute
 * email + organizationId when the caller is signed in).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { captureFeedback, isFeedbackSentiment } from "@/lib/feedback/feedbackStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const body = (await req.json()) as { sentiment?: string; message?: string; pagePath?: string } | null;
    if (!body?.message || !body.sentiment || !isFeedbackSentiment(body.sentiment)) {
      throw AxiomErrors.validation("feedback.invalid", "sentiment + message required.");
    }

    const ctx = await currentContext().catch(() => null);
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const result = await captureFeedback({
      sentiment: body.sentiment,
      message: body.message,
      pagePath: body.pagePath,
      email: ctx?.email,
      organizationId: ctx?.organizationId ? String(ctx.organizationId) : undefined,
      userAgent,
    });
    return apiOk(result, {
      correlationId,
      safetyContract: "notification_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "notification_read_only" });
  }
}
