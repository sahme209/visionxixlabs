/**
 * POST /api/ai/generate
 *
 * Generic text generation through the fallback chain. Operators call
 * this from the settings page "Try it" affordance, but the same route
 * is reusable by feature code.
 *
 * Body: { prompt: string; system?: string; maxTokens?: number;
 *         temperature?: number; only?: AIProviderName; model?: string }
 *
 * Response: AITextResponse + the set of attempted providers (so the
 * UI can show "GitHub Models tried, fell back to Ollama").
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { isAIProviderName, type AIProviderName } from "@/lib/ai/AIProvider";
import { isKnownModel } from "@/lib/ai/AIModelRegistry";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { recordAIUsageEvent } from "@/lib/billing/recordAIUsageEvent";
import { attachAICreditReservationUsage, releaseAICreditReservation, reserveAICredits, settleAICreditReservation } from "@/lib/billing/aiCreditReservation";
import { prisma } from "@/lib/db";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_REQUEST_RESERVATION_CENTS = 1000;

function requestReservationCents(): number {
  const configured = Number(process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 10_000
    ? configured
    : DEFAULT_REQUEST_RESERVATION_CENTS;
}

interface PostBody {
  prompt?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  only?: AIProviderName;
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
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
    const reservation = await reserveAICredits(prisma, {
      organizationId: ctx.organizationId,
      idempotencyKey,
      reservedCents: requestReservationCents(),
      correlationId,
    });
    if (!reservation.ok) {
      if (reservation.error === "ai_credit_pool_exhausted") {
        throw AxiomErrors.policy("ai.credit_pool_exhausted", "This workspace does not have enough available AI credit for this request.");
      }
      throw AxiomErrors.external("ai.credit_reservation_unavailable", "AI budget controls are temporarily unavailable. No generation was run.");
    }
    if (reservation.reused) {
      throw AxiomErrors.policy("ai.request_already_in_progress", "This request key is already reserved. Wait for the existing request to finish before retrying.");
    }
    let result;
    try {
      result = await mgr.generateText(body.prompt, {
      system: body.system,
      maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      model: body.model,
      only: body.only,
      correlationId,
      organizationId: ctx.organizationId,
      allowedProviders: policy.allowedProviders,
      modelSelections: policy.modelSelections,
      fallbackOrder: policy.fallbackOrder,
      });
    } catch (error) {
      await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
      throw error;
    }
    // Persist only provider-reported usage. Prompts, system instructions,
    // credentials, and provider account data never enter the usage event.
    if (result.usage) {
      const usageInput = {
        organizationId: ctx.organizationId,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.promptTokens ?? 0,
        outputTokens: result.usage.completionTokens ?? 0,
        externalUsageId: result.gatewayGenerationId,
        triggeredBy: ctx.userId,
        correlationId,
        metadata: { route: "api/ai/generate" },
      };
      let usageWrite;
      let gatewayUsageAttached = false;
      if (result.provider === "vercel_gateway") {
        try {
          usageWrite = await prisma.$transaction(async (tx) => {
            const pendingUsage = await recordAIUsageEvent(usageInput, tx);
            if (!pendingUsage.recorded || pendingUsage.cost) return pendingUsage;
            if (!pendingUsage.usageEventId || !await attachAICreditReservationUsage(tx, organizationId, reservation.reservation.id, pendingUsage.usageEventId)) {
              // Throwing rolls back the just-created pending UsageEvent as
              // well as any attachment, leaving the original hold releasable.
              throw new Error("ai_usage_reservation_attach_failed");
            }
            return pendingUsage;
          });
          gatewayUsageAttached = usageWrite.recorded && !usageWrite.cost;
        } catch (error) {
          await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
          throw error;
        }
      } else {
        usageWrite = await recordAIUsageEvent(usageInput);
      }
      if (!usageWrite.recorded) {
        await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
        throw new Error("ai_usage_meter_unavailable");
      }
      // Gateway settlement is authoritative but asynchronous. Keep the hold
      // active until that reconciler supplies a real cost; direct-provider
      // calls settle immediately against their measured amount.
      if (usageWrite.cost && !await settleAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id, usageWrite.cost.totalCents, usageWrite.usageEventId)) {
        await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
        throw new Error("ai_usage_meter_unavailable");
      }
      if (!usageWrite.cost && !gatewayUsageAttached && !await attachAICreditReservationUsage(prisma, ctx.organizationId, reservation.reservation.id, usageWrite.usageEventId!)) {
        await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
        throw new Error("ai_usage_meter_unavailable");
      }
    } else {
      await releaseAICreditReservation(prisma, ctx.organizationId, reservation.reservation.id);
    }
    return apiOk(result, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
