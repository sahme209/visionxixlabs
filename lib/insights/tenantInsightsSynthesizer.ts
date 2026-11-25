/**
 * Tenant insights synthesizer.
 *
 * Takes a digest of the tenant's recent activity (proposals decided,
 * outbound failure rate, autonomy cycles, dissent count) and produces
 * a 3-5 sentence operator-facing summary via the AI manager. Best-
 * effort: deterministic template on AI failure.
 *
 * The input is intentionally aggregate (no raw events) so the prompt
 * stays small AND we never accidentally send tenant prompts/secrets to
 * the model.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { admitAIText } from "@/lib/billing/governedExtractAdmission";
import { effectiveGatewayModel, gatewayModelOutputBoundVerified } from "@/lib/ai/effectiveGatewayModel";

export interface InsightsSeed {
  tenantId: string;
  windowDays: number;             // e.g. 7
  proposalsDecided: number;
  proposalsApproved: number;
  proposalsApplied: number;
  proposalsRejected: number;
  autonomyCycles: number;
  outboundSends: number;
  outboundFailures: number;
  dissentCount: number;           // legacy wire field for council consensus records
  topAuthorAgent: string | null;  // most active improver agent name
}

export interface InsightsNarrative {
  paragraph: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  status: "metrics" | "generated" | "budget_exceeded" | "credits_exhausted" | "already_requested" | "unavailable";
}

const SYSTEM = [
  "You write a 3-5 sentence operator-facing summary of an AGI ops tenant's last week.",
  "Style: factual, plain English, no marketing, no emojis.",
  "Mention the proposal funnel (decided / approved / applied / rejected), outbound success ratio, autonomy throughput, and recorded council decisions.",
  "Never invent numbers beyond the input.",
].join(" ");

const MAX_OUT = 700;

function templateFallback(s: InsightsSeed): string {
  const outboundRatio = s.outboundSends === 0 ? "no outbound sends" : `${s.outboundSends - s.outboundFailures}/${s.outboundSends} sends ok`;
  const topAuthor = s.topAuthorAgent ? ` Most active improver: ${s.topAuthorAgent}.` : "";
  return [
    `Last ${s.windowDays} day(s): ${s.proposalsDecided} proposal(s) decided`,
    `(${s.proposalsApproved} approved, ${s.proposalsApplied} applied, ${s.proposalsRejected} rejected).`,
    `${s.autonomyCycles} autonomy cycle(s). ${outboundRatio}.`,
    `${s.dissentCount} council consensus record(s).${topAuthor}`,
  ].join(" ");
}

export function summarizeInsightsMetrics(seed: InsightsSeed, status: InsightsNarrative["status"] = "metrics"): InsightsNarrative {
  return { paragraph: templateFallback(seed), status, aiUsed: false, provider: null, model: null, latencyMs: 0 };
}

export async function synthesizeInsights(seed: InsightsSeed, actor: {userId: string; correlationId: string; idempotencyKey: string}): Promise<InsightsNarrative> {
  const organizationId = seed.tenantId;
  try {
    const manager = getAIProviderManager();
    const gateway = manager.status().find(provider => provider.configured && provider.provider === "vercel_gateway");
    const loaded = await loadWorkspaceAIProviderPolicyWithState(organizationId);
    if (!gateway || loaded.storageState !== "ready") return summarizeInsightsMetrics(seed, "unavailable");
    const policy = resolveWorkspaceAIProviderPolicy({ stored: loaded.policy, serviceEnabled: ["vercel_gateway"] });
    const defaultModel = gateway.defaultModel;
    const model = effectiveGatewayModel({ modelSelection: policy.modelSelections.vercel_gateway, defaultModel });
    if (!policy.enabled || !policy.allowedProviders.includes("vercel_gateway") || !gatewayModelOutputBoundVerified(model)) {
      return summarizeInsightsMetrics(seed, "unavailable");
    }
    const prompt = [
      `Window: last ${seed.windowDays} day(s)`,
      `Proposals decided: ${seed.proposalsDecided}`,
      `Proposals approved: ${seed.proposalsApproved}`,
      `Proposals applied: ${seed.proposalsApplied}`,
      `Proposals rejected: ${seed.proposalsRejected}`,
      `Autonomy cycles: ${seed.autonomyCycles}`,
      `Outbound sends: ${seed.outboundSends}`,
      `Outbound failures: ${seed.outboundFailures}`,
      `Council consensus records: ${seed.dissentCount}`,
    ].join("\n");
    const admission = await admitAIText({
      organizationId, userId: actor.userId, correlationId: actor.correlationId, idempotencyKey: actor.idempotencyKey, source: "tenant_insights", textPolicy: { provider: "vercel_gateway", model, defaultModel },
    }, { prompt, system: SYSTEM });
    if (!admission.ok) {
      const status = {
        ai_workspace_budget_exceeded: "budget_exceeded",
        ai_credit_pool_exhausted: "credits_exhausted",
        request_already_reserved: "already_requested",
        idempotency_key_conflict: "already_requested",
        ai_credit_reservation_unavailable: "unavailable",
      } as const;
      return summarizeInsightsMetrics(seed, status[admission.error]);
    }
    const result = await manager.generateTextWithAdmission(prompt, {
      system: SYSTEM, maxTokens: 512, temperature: 0.3, timeoutMs: 15_000,
      organizationId, correlationId: actor.correlationId, only: "vercel_gateway", model,
    }, admission.admission);
    const text = result.text.trim();
    if (!text) return summarizeInsightsMetrics(seed, "unavailable");
    const paragraph = text.length > MAX_OUT ? `${text.slice(0, MAX_OUT - 3)}...` : text;
    return { paragraph, status: "generated", aiUsed: true, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
  } catch {
    return summarizeInsightsMetrics(seed, "unavailable");
  }
}
