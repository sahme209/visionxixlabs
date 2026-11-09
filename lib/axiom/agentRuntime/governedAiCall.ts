import { SMALL_SONNET_55_MODEL, SMALL_SONNET_55_OUTPUT_TOKENS } from "@/lib/billing/smallSonnet55Request";
import { effectiveGatewayModel, gatewayModelOutputBoundVerified } from "@/lib/ai/effectiveGatewayModel";
import { boundedStructuredAIInput } from "@/lib/ai/inputByteBound";
import { redactSecrets } from "@/lib/ai/contextRedaction";
/**
 * The one place the agent decision loop is allowed to call an LLM.
 * Mirrors the exact fail-closed sequence lib/releaseops/instrumentedAiFetcher.ts
 * already uses for workspace-scoped AI calls: AI is opt-in per workspace
 * (never defaults to enabled), a credit-meter outage fails closed, and an
 * unresolvable provider policy fails closed — never silently falls back
 * to an unapproved provider or an unmetered call.
 */

import "server-only";

import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { gatewayPolicyModelIds, loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { isAIProviderName, type AIProviderName, type AITextResponse } from "@/lib/ai/AIProvider";
import { admitGovernedExtract } from "@/lib/billing/governedExtractAdmission";
import { AI_REQUEST_MAX_OUTPUT_TOKENS } from "@/lib/billing/requestReservationCents";
import { isConcreteGatewayModelId, loadGatewayModelCatalog } from "@/lib/ai/gatewayModelCatalog";
import { GovernedAiCallRefusal } from "./governedAiCallRefusal";
import { SMALL_SONNET_MODEL } from "@/lib/billing/smallSonnetRequest";
import { AICreditAdmissionRefusal } from "@/lib/billing/aiCreditAdmissionRefusal";
import { AgentStreamInterrupted } from "@/lib/ai/streamedDecisionMessage";

export type GovernedAiCallError =
  | "workspace_ai_disabled"
  | "workspace_ai_provider_unavailable"
  | "workspace_ai_model_not_allowed"
  | "workspace_ai_output_bound_unverified"
  | "workspace_ai_policy_unavailable"
  | "workspace_ai_credit_meter_unavailable"
  | "workspace_ai_credit_pool_exhausted";

export type GovernedAiCallResult =
  | {
    ok: true;
    /**
     * Keep provider-reported token data attached to the governed response.
     * Callers must not derive a customer price from it: gateway settlement and
     * workspace credit policy are authoritative for that separately.
     */
    extract: <T>(text: string, schemaHint: string, correlationId: string) => Promise<{
      data: T;
      usage?: AITextResponse["usage"];
    }>;
  }
  | { ok: false; error: GovernedAiCallError };

/** Current server authority snapshot; no model or provider comes from model
 * output. A managed service-default can remain implicit for legacy clients. */
async function currentDispatch(organizationId: string, preferredProvider?: string, preferredModel?: string) {
  if (preferredModel !== undefined && (!isConcreteGatewayModelId(preferredModel) || preferredProvider !== "vercel_gateway")) {
    return { ok: false as const, error: "workspace_ai_model_not_allowed" as const };
  }
  const loaded = await loadWorkspaceAIProviderPolicyWithState(organizationId).catch(() => null);
  if (!loaded || loaded.storageState !== "ready") return { ok: false as const, error: "workspace_ai_policy_unavailable" as const };
  const manager = getAIProviderManager();
  const serviceStatus = manager.status();
  const policy = resolveWorkspaceAIProviderPolicy({
    stored: loaded.policy,
    serviceEnabled: serviceStatus.filter(p => p.configured && p.provider === "vercel_gateway" && manager.isServiceProviderAvailable(p.provider)).map(p => p.provider),
  });
  if (!policy.enabled) return { ok: false as const, error: "workspace_ai_disabled" as const };
  if (policy.allowedProviders.length === 0) return { ok: false as const, error: "workspace_ai_provider_unavailable" as const };
  if (preferredProvider && (!isAIProviderName(preferredProvider) || !policy.allowedProviders.includes(preferredProvider))) {
    return { ok: false as const, error: "workspace_ai_model_not_allowed" as const };
  }
  if (preferredModel !== undefined && !gatewayPolicyModelIds(policy).includes(preferredModel)) {
    return { ok: false as const, error: "workspace_ai_model_not_allowed" as const };
  }
  const selected = preferredModel ?? policy.modelSelections.vercel_gateway;
  const effectiveModel = effectiveGatewayModel({ model: preferredModel, modelSelection: policy.modelSelections.vercel_gateway,
    defaultModel: serviceStatus.find(row => row.provider === "vercel_gateway")?.defaultModel });
  if (!gatewayModelOutputBoundVerified(effectiveModel)) {
    return { ok: false as const, error: "workspace_ai_output_bound_unverified" as const };
  }
  if (policy.allowedProviders.includes("vercel_gateway") && selected && selected !== "service-default" && !selected.startsWith("vmc/")) {
    // Dispatch deliberately bypasses the UI catalog's 900-second cache. The
    // service allowlist is applied by the existing loader on every read.
    const catalog = await loadGatewayModelCatalog({ freshness: "current" }).catch(() => null);
    if (!catalog) return { ok: false as const, error: "workspace_ai_policy_unavailable" as const };
    if (!catalog.some(model => model.id === selected)) return { ok: false as const, error: "workspace_ai_model_not_allowed" as const };
  }
  const only: AIProviderName | undefined = preferredProvider && isAIProviderName(preferredProvider) ? preferredProvider : undefined;
  return { ok: true as const, manager, policy, only, effectiveModel };
}

export async function resolveGovernedAiCall(organizationId: string, preferredProvider: string | undefined, userId: string, preferredModel?: string, streaming?: { abortSignal: AbortSignal; onDraft: (message: string) => void; beforeAdmission?: () => Promise<void> }): Promise<GovernedAiCallResult> {
  if (!userId) return { ok: false, error: "workspace_ai_credit_meter_unavailable" };
  const creditDecision = await checkWorkspaceAICredits(organizationId, 0, { failClosedOnUsageReadError: true }).catch(() => null);
  if (!creditDecision) return { ok: false, error: "workspace_ai_credit_meter_unavailable" };
  if (creditDecision.kind === "block") return { ok: false, error: "workspace_ai_credit_pool_exhausted" };
  const initial = await currentDispatch(organizationId, preferredProvider, preferredModel);
  if (!initial.ok) return initial;
  return {
    ok: true,
    extract: async <T>(rawText: string, schemaHint: string, correlationId: string) => {
      streaming?.abortSignal.throwIfAborted();
      // A7.16 context minimization: credentials never reach a model through the governed path.
      const text = redactSecrets(rawText).text;
      // A loop's initial opt-in is not lasting authority: reread before EACH
      // actual extract, including repair, and before creating its budget hold.
      const current = await currentDispatch(organizationId, preferredProvider, preferredModel);
      if (!current.ok) throw new GovernedAiCallRefusal(current.error);
      streaming?.abortSignal.throwIfAborted();
      const scope = { organizationId, userId, correlationId };
      const model = preferredModel ?? current.policy.modelSelections.vercel_gateway;
      boundedStructuredAIInput(text, schemaHint);
      // Optional narrower caller fence, after awaited model-policy discovery.
      // A denial cannot create an admission or a credit hold.
      await streaming?.beforeAdmission?.();
      streaming?.abortSignal.throwIfAborted();
      const admission = await ((model === SMALL_SONNET_MODEL || model === SMALL_SONNET_55_MODEL)
        ? admitGovernedExtract(scope, { model, text, schemaHint }, streaming?.abortSignal)
        : admitGovernedExtract(scope)).catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") throw error;
        if (error instanceof AICreditAdmissionRefusal) throw new GovernedAiCallRefusal("workspace_ai_credit_pool_exhausted");
        throw new AgentStreamInterrupted();
      });
      // Admission can await a durable credit claim. Reread narrower caller
      // authority after that wait and immediately before SDK consumption.
      // Refusal retains the claimed hold; it is never treated as a free retry.
      await streaming?.beforeAdmission?.();
      streaming?.abortSignal.throwIfAborted();
      const options = {
        organizationId,
        allowedProviders: current.policy.allowedProviders,
        modelSelections: current.policy.modelSelections,
        fallbackOrder: current.policy.fallbackOrder,
        model: current.effectiveModel,
        correlationId,
        temperature: 0.1,
        maxTokens: model === SMALL_SONNET_55_MODEL ? SMALL_SONNET_55_OUTPUT_TOKENS : AI_REQUEST_MAX_OUTPUT_TOKENS,
        only: current.only,
      };
      const result = streaming
        ? await current.manager.extractStructuredDataStreamingWithAdmission<T>(text, schemaHint, { ...options, abortSignal: streaming.abortSignal }, admission, streaming.onDraft)
        : await current.manager.extractStructuredDataWithAdmission<T>(text, schemaHint, options, admission);
      return { data: result.data, usage: result.usage };
    },
  };
}
