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
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 4096;

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
    if (policy.allowedProviders.length === 0) {
      throw AxiomErrors.validation("ai.provider_unavailable", "No AI provider is enabled for this workspace.");
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
    const result = await mgr.generateText(body.prompt, {
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
    return apiOk(result, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
