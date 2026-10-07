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
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { isAIProviderName, type AIProviderName } from "@/lib/ai/AIProvider";

export type GovernedAiCallError =
  | "workspace_ai_disabled"
  | "workspace_ai_provider_unavailable"
  | "workspace_ai_model_not_allowed"
  | "workspace_ai_policy_unavailable"
  | "workspace_ai_credit_meter_unavailable"
  | "workspace_ai_credit_pool_exhausted";

export type GovernedAiCallResult =
  | { ok: true; extract: <T>(text: string, schemaHint: string, correlationId: string) => Promise<T> }
  | { ok: false; error: GovernedAiCallError };

export async function resolveGovernedAiCall(organizationId: string, preferredProvider?: string): Promise<GovernedAiCallResult> {
  const creditDecision = await checkWorkspaceAICredits(organizationId, 0, { failClosedOnUsageReadError: true }).catch(() => null);
  if (!creditDecision) return { ok: false, error: "workspace_ai_credit_meter_unavailable" };
  if (creditDecision.kind === "block") return { ok: false, error: "workspace_ai_credit_pool_exhausted" };

  const loaded = await loadWorkspaceAIProviderPolicyWithState(organizationId);
  if (loaded.storageState !== "ready") return { ok: false, error: "workspace_ai_policy_unavailable" };

  const manager = getAIProviderManager();
  const policy = resolveWorkspaceAIProviderPolicy({
    stored: loaded.policy,
    serviceEnabled: manager.status().filter((p) => p.configured && p.provider !== "mock").map((p) => p.provider),
  });
  if (!policy.enabled) return { ok: false, error: "workspace_ai_disabled" };
  if (policy.allowedProviders.length === 0) return { ok: false, error: "workspace_ai_provider_unavailable" };
  if (preferredProvider && (!isAIProviderName(preferredProvider) || !policy.allowedProviders.includes(preferredProvider))) {
    return { ok: false, error: "workspace_ai_model_not_allowed" };
  }
  const only: AIProviderName | undefined = preferredProvider && isAIProviderName(preferredProvider) ? preferredProvider : undefined;

  return {
    ok: true,
    extract: async <T>(text: string, schemaHint: string, correlationId: string) => {
      const result = await manager.extractStructuredData<T>(text, schemaHint, {
        organizationId,
        allowedProviders: policy.allowedProviders,
        modelSelections: policy.modelSelections,
        fallbackOrder: policy.fallbackOrder,
        correlationId,
        temperature: 0.1,
        only,
      });
      return result.data;
    },
  };
}
