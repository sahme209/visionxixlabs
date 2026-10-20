import { withIsolatedWorkspaceScope } from "@/lib/billing/isolatedApplication/scope";
/**
 * POST /api/ai/generate
 *
 * Generic text generation through the configured service Gateway. Operators call
 * this from the settings page "Try it" affordance, but the same route
 * is reusable by feature code.
 *
 * Body: { prompt: string; system?: string; maxTokens?: number;
 *         temperature?: number; only?: AIProviderName; model?: string }
 *
 * Response: the existing AITextResponse envelope, after durable usage linkage.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { isAIProviderName, type AIProviderName } from "@/lib/ai/AIProvider";
import { isKnownModel } from "@/lib/ai/AIModelRegistry";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { admitAIText } from "@/lib/billing/governedExtractAdmission";
import { AI_REQUEST_MAX_OUTPUT_TOKENS as MAX_OUTPUT_TOKENS } from "@/lib/billing/requestReservationCents";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 8000;

interface PostBody {
  prompt?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  only?: AIProviderName;
}

async function handlePost(req: NextRequest, ctx: Awaited<ReturnType<typeof currentContext>>) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const organizationId = ctx.organizationId;
    const body = (await req.json().catch(() => null)) as PostBody | null;
    if (!body || typeof body.prompt !== "string" || body.prompt.length === 0) {
      throw AxiomErrors.validation("ai.prompt_required", "Provide a non-empty 'prompt'.");
    }
    if (body.prompt.length > MAX_PROMPT_CHARS) {
      throw AxiomErrors.validation("ai.prompt_too_long", `Prompt exceeds ${MAX_PROMPT_CHARS} chars.`);
    }
    if (body.system !== undefined && (typeof body.system !== "string" || body.system.length > MAX_SYSTEM_CHARS)) {
      throw AxiomErrors.validation("ai.system_too_long", `System instructions must be at most ${MAX_SYSTEM_CHARS} chars.`);
    }
    if (body.maxTokens !== undefined && (!Number.isInteger(body.maxTokens) || body.maxTokens < 1 || body.maxTokens > MAX_OUTPUT_TOKENS)) {
      throw AxiomErrors.validation("ai.max_tokens_invalid", `Choose an output limit between 1 and ${MAX_OUTPUT_TOKENS} tokens.`);
    }
    if (body.temperature !== undefined && (typeof body.temperature !== "number" || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
      throw AxiomErrors.validation("ai.temperature_invalid", "Choose a temperature between 0 and 2.");
    }
    const mgr = getAIProviderManager();
    const serviceEnabled = mgr.status()
      .filter((provider) => provider.configured && provider.provider !== "mock")
      .map((provider) => provider.provider);
    const loadedPolicy = await loadWorkspaceAIProviderPolicyWithState(ctx.organizationId);
    if (loadedPolicy.storageState !== "ready") {
      throw AxiomErrors.policy(
        "ai.provider_policy_unavailable",
        "AI provider policy is not ready for this workspace. No generation was run.",
        { storageState: loadedPolicy.storageState },
      );
    }
    const policy = resolveWorkspaceAIProviderPolicy({
      stored: loadedPolicy.policy,
      serviceEnabled,
    });
    if (!policy.enabled) {
      throw AxiomErrors.policy(
        "ai.workspace_disabled",
        "AI generation is disabled for this workspace. No generation was run.",
      );
    }
    if (policy.allowedProviders.length === 0) {
      throw AxiomErrors.validation("ai.provider_unavailable", "No AI provider is enabled for this workspace.");
    }
    // This general-purpose generation endpoint must never become an
    // unmetered escape hatch. Check the tenant's AI credit pool before a
    // provider call, and fail closed when the meter cannot be read.
    const creditDecision = await checkWorkspaceAICredits(
      ctx.organizationId,
      0,
      { failClosedOnUsageReadError: true },
    ).catch(() => {
      throw AxiomErrors.external(
        "ai.credit_meter_unavailable",
        "AI usage controls are temporarily unavailable. No generation was run.",
      );
    });
    if (creditDecision.kind === "block") {
      throw AxiomErrors.policy(
        "ai.credit_pool_exhausted",
        "This workspace has reached its AI credit limit. No generation was run.",
        { threshold: creditDecision.threshold, remainingCents: creditDecision.remainingCents },
      );
    }
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{16,200}$/.test(idempotencyKey)) {
      throw AxiomErrors.validation("ai.idempotency_key_required", "Provide a stable request key before generation can begin.");
    }
    if (body.only !== undefined && (!isAIProviderName(body.only) || !policy.allowedProviders.includes(body.only))) {
      throw AxiomErrors.validation("ai.provider_unavailable", "That AI provider is not enabled for this workspace.");
    }
    if (body.model !== undefined && (typeof body.model !== "string" || !body.only || !isKnownModel(body.only, body.model))) {
      throw AxiomErrors.validation("ai.model_unavailable", "Choose a supported model from an enabled provider.");
    }
    if (body.model !== undefined && body.only && policy.modelSelections[body.only] !== body.model) {
      throw AxiomErrors.validation("ai.model_not_approved", "That model is not approved for this workspace provider.");
    }
    const reservation = await admitAIText({ organizationId, userId: ctx.userId, idempotencyKey, correlationId });
    if (!reservation.ok) {
      if (reservation.error === "request_already_reserved") {
        throw AxiomErrors.policy("ai.request_already_in_progress", "This request key is already reserved. Wait for the existing request to finish before retrying.");
      }
      if (reservation.error === "ai_credit_pool_exhausted") {
        throw AxiomErrors.policy("ai.credit_pool_exhausted", "This workspace does not have enough available AI credit for this request.");
      }
      throw AxiomErrors.external("ai.credit_reservation_unavailable", "AI budget controls are temporarily unavailable. No generation was run.");
    }
    // The one-use admission was durably claimed before the manager can hand
    // off to the SDK. It records one attributed envelope before returning data;
    // uncertain/missing-usage/write failures cannot release claimed capacity.
    const result = await mgr.generateTextWithAdmission(body.prompt, {
      system: body.system,
      maxTokens: body.maxTokens ?? MAX_OUTPUT_TOKENS,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      model: body.model,
      only: body.only,
      correlationId,
      organizationId,
      allowedProviders: policy.allowedProviders,
      modelSelections: policy.modelSelections,
      fallbackOrder: policy.fallbackOrder,
    }, reservation.admission);
    return apiOk(result, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await currentContext();
    return await withIsolatedWorkspaceScope(context, "admission", () => handlePost(req, context));
  } catch (error) {
    return apiErr(error, { correlationId: resolveCorrelationId(req.headers), safetyContract: "audit_read_only" });
  }
}
