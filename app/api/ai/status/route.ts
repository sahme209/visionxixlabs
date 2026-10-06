/**
 * GET /api/ai/status
 *
 * Returns only provider families and models approved for the caller's
 * workspace. Service configuration and environment readiness stay private.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { listModels } from "@/lib/ai/AIModelRegistry";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const mgr = getAIProviderManager();
    const status = mgr.status();
    const serviceEnabled = status
      .filter((provider) => provider.provider !== "mock" && provider.configured)
      .map((provider) => provider.provider);
    const loadedPolicy = await loadWorkspaceAIProviderPolicyWithState(ctx.organizationId);
    if (loadedPolicy.storageState !== "ready") {
      throw AxiomErrors.policy("ai.provider_policy_unavailable", "AI provider policy is not ready for this workspace.");
    }
    const policy = resolveWorkspaceAIProviderPolicy({ stored: loadedPolicy.policy, serviceEnabled });
    const allowed = policy.enabled ? policy.allowedProviders : [];
    const activeProvider = policy.enabled ? policy.fallbackOrder[0] ?? null : null;
    const activeModel = activeProvider ? policy.modelSelections[activeProvider] ?? null : null;
    const data = {
      policyEnabled: policy.enabled,
      activeProvider,
      activeModel,
      // Only expose provider families explicitly allowed for this workspace;
      // service configuration and credentials remain server-private.
      providers: allowed.map((provider, priority) => {
        const configured = status.find((row) => row.provider === provider);
        const selectedModel = policy.modelSelections[provider];
        return {
          provider,
          configured: configured?.configured === true,
          defaultModel: selectedModel ?? configured?.defaultModel ?? "unavailable",
          priority,
          models: selectedModel ? listModels(provider).filter((model) => model.id === selectedModel) : [],
        };
      }),
    };
    return apiOk(data, {
      correlationId,
      safetyContract: "audit_read_only",
      // This endpoint reports configured, policy-approved routes—not a live
      // provider probe. Health has a separate endpoint, so never call this
      // configuration view "live" on its own.
      sourceMode: asApiSourceMode(!policy.enabled ? "disabled" : allowed.length > 0 ? "partial_live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
