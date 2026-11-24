/**
 * GET or POST /api/ai/health
 *
 * Reads configured workspace routes. Provider inference requires separate admission.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const manager = getAIProviderManager();
    const serviceEnabled = manager.status()
      .filter((provider) => provider.configured && provider.provider !== "mock")
      .map((provider) => provider.provider);
    const loadedPolicy = await loadWorkspaceAIProviderPolicyWithState(ctx.organizationId);
    if (loadedPolicy.storageState !== "ready") {
      throw AxiomErrors.policy("ai.provider_policy_unavailable", "AI provider policy is not ready for this workspace.");
    }
    const policy = resolveWorkspaceAIProviderPolicy({ stored: loadedPolicy.policy, serviceEnabled });
    const rows = policy.allowedProviders.map((provider) => ({
      provider,
      model: policy.modelSelections[provider] ?? null,
    }));
    return apiOk({
      rows,
      policyEnabled: policy.enabled,
      health: "not_measured",
      generatedAt: new Date().toISOString(),
    }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode(policy.enabled ? "preview" : "disabled"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
