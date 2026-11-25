/**
 * Phase 531 — Instrumented AI fetcher wrapper.
 *
 * Wraps any RationaleAiFetcher with:
 *   1. Pre-call circuit breaker check (skip provider if open)
 *   2. Latency timing
 *   3. Token usage extraction (best-effort — provider response may
 *      or may not carry the usage block)
 *   4. Persistent log of every call
 *
 * Engine call sites get a drop-in replacement: same signature, same
 * return shape. The only behavioral change is that when the breaker
 * is open, the call throws "circuit_open_<engineName>" instead of
 * hitting the provider — engines already catch fetcher errors and
 * fall back to deterministic rules, so the breaker degrades the AGI
 * gracefully when the provider is sick.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { effectiveGatewayModel, gatewayModelOutputBoundVerified } from "@/lib/ai/effectiveGatewayModel";
import type { PreferredProvider } from "@/lib/ai/directProviderCall";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { recordAIUsageEvent } from "@/lib/billing/recordAIUsageEvent";
import { admitAIText } from "@/lib/billing/governedExtractAdmission";
import { workspaceAIUsageBudgetsEnabled } from "@/lib/billing/workspaceAIUsageBudget";
import { publicBillingPolicyEnabled } from "@/lib/billing/publicBillingConfig";
import { boundedAIOutputTokens } from "@/lib/billing/requestReservationCents";
import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";
import {
  lookupCircuitState,
  persistAiCallLog,
  type AiCallLogRepo,
} from "./aiCallLogResponder";
import { shouldShortCircuit, type CircuitConfig } from "./aiCallLogEngine";

export const WORKSPACE_AI_ACTOR_REQUIRED = "workspace_ai_billing_actor_required";

export function isRuleFallbackReason(message: string): boolean {
  return message === WORKSPACE_AI_ACTOR_REQUIRED || message.startsWith("circuit_open_");
}

export interface InstrumentedFetcherOptions {
  /** Engine name for log + circuit scope. Stored on every row. */
  engineName: string;
  /** Optional org for scoping log rows. Null when unscoped (cron). */
  organizationId?: string | null;
  /** Real initiating workspace member from the authenticated server context. */
  actorUserId?: string | null;
  /** Override breaker thresholds — engineers may tune per engine. */
  circuitConfig?: Partial<CircuitConfig>;
  /** Provider call timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Override the AI provider manager (testing). Defaults to live. */
  generateText?: (prompt: string, opts: { maxTokens: number; temperature: number }) => Promise<unknown>;
  /** Wall-clock provider for tests. */
  now?: () => Date;
  /** Legacy routing hint retained for compatibility. All inference is
   *  executed through Vercel AI Gateway; direct-provider routing is denied. */
  preferredProvider?: PreferredProvider;
  /** Override sampling max_tokens. Defaults to 500 to match the
   *  legacy path; domain engineers that need longer structured
   *  output (specs, refactor plans) pass 2000+. */
  maxTokens?: number;
  /** Override sampling temperature. Defaults to 0.2 (deterministic). */
  temperature?: number;
}

/**
 * Returns a fetcher matching the RationaleAiFetcher contract that
 * routes every call through the circuit breaker + logger.
 */
export function makeInstrumentedFetcher(opts: InstrumentedFetcherOptions): RationaleAiFetcher {
  const engineName = opts.engineName;
  const orgId = opts.organizationId ?? null;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const now = opts.now ?? (() => new Date());
  const repo = prisma as unknown as AiCallLogRepo;

  return async (prompt) => {
    const startedAt = now();
    const startMs = startedAt.getTime();

    // Pre-call circuit check.
    const state = await lookupCircuitState(repo, engineName, startedAt, opts.circuitConfig);
    if (shouldShortCircuit(state)) {
      // Log the short-circuit so the dashboard reflects it.
      await persistAiCallLog(repo, {
        organizationId: orgId,
        engineName,
        model: null,
        outcome: "short_circuit",
        errorMessage: `circuit ${state}`,
        latencyMs: 0,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
      throw new Error(`circuit_open_${engineName}`);
    }

    // Provider call with timeout race.
    const actorMissing = Boolean(orgId && !opts.actorUserId);
    const funded = Boolean(orgId && (publicBillingPolicyEnabled() || workspaceAIUsageBudgetsEnabled()));
    let attempted = false;
    let raw: {
      text: string;
      provider: string;
      model: string;
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
      gatewayGenerationId?: string;
    };
    try {
      const maxTokens = opts.maxTokens ?? 500;
      const temperature = opts.temperature ?? 0.2;
      if (actorMissing) throw new Error(WORKSPACE_AI_ACTOR_REQUIRED);
      // Preserve the read-side check during the rollout on legacy workers.
      if (orgId && !funded) {
        const creditDecision = await checkWorkspaceAICredits(
          orgId,
          0,
          { failClosedOnUsageReadError: true },
        ).catch(() => {
          throw new Error("workspace_ai_credit_meter_unavailable");
        });
        if (creditDecision.kind === "block") {
          throw new Error("workspace_ai_credit_pool_exhausted");
        }
      }
      // Every scoped and unscoped job uses the same Gateway-only manager.
      const manager = getAIProviderManager();
      const loadedPolicy = orgId
        ? await loadWorkspaceAIProviderPolicyWithState(orgId)
        : null;
      if (loadedPolicy && loadedPolicy.storageState !== "ready") {
        throw new Error("workspace_ai_policy_unavailable");
      }
      const workspacePolicy = loadedPolicy
        ? resolveWorkspaceAIProviderPolicy({
          stored: loadedPolicy.policy,
          serviceEnabled: manager.status()
            .filter((provider) => provider.configured && provider.provider !== "mock")
            .map((provider) => provider.provider),
        })
        : null;
      if (workspacePolicy && !workspacePolicy.enabled) {
        throw new Error("workspace_ai_disabled");
      }
      if (workspacePolicy && !workspacePolicy.allowedProviders.includes("vercel_gateway")) {
        throw new Error("workspace_ai_provider_unavailable");
      }
      const dispatch = {
        maxTokens, temperature, organizationId: orgId ?? undefined,
        only: "vercel_gateway" as const,
        allowedProviders: workspacePolicy?.allowedProviders,
        modelSelections: workspacePolicy?.modelSelections,
        fallbackOrder: workspacePolicy?.fallbackOrder,
      };
      let result: unknown;
      if (funded && orgId && opts.actorUserId) {
        const defaultModel = manager.status().find(row => row.provider === "vercel_gateway")?.defaultModel;
        const model = effectiveGatewayModel({ modelSelection: workspacePolicy?.modelSelections.vercel_gateway, defaultModel });
        if (!gatewayModelOutputBoundVerified(model)) throw new Error("workspace_ai_output_bound_unverified");
        boundedAIOutputTokens(maxTokens);
        const correlationId = `releaseops_${randomUUID()}`;
        const admission = await admitAIText({
          organizationId: orgId, userId: opts.actorUserId, correlationId, idempotencyKey: correlationId,
          source: "releaseops", textPolicy: { provider: "vercel_gateway", model, defaultModel },
        }, { prompt });
        if (!admission.ok) throw new Error(admission.error);
        attempted = true;
        result = await raceWithTimeout(manager.generateTextWithAdmission(prompt, { ...dispatch, correlationId, model }, admission.admission), timeoutMs);
      } else {
        const generate = opts.generateText ?? ((p: string) => manager.generateText(p, dispatch));
        result = await raceWithTimeout(generate(prompt, { maxTokens, temperature }), timeoutMs);
      }
      raw = result as typeof raw;
    } catch (err) {
      const latencyMs = now().getTime() - startMs;
      const isTimeout = err instanceof Error && err.message === "ai_timeout";
      await persistAiCallLog(repo, {
        organizationId: orgId,
        engineName,
        model: null,
        outcome: (actorMissing || funded && !attempted) ? "short_circuit" : isTimeout ? "timeout" : "error",
        errorMessage: err instanceof Error ? err.message : "unknown",
        latencyMs,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
      throw err;
    }

    const latencyMs = now().getTime() - startMs;
    // Funded generation records its usage with the reservation. Legacy scope
    // still needs the pre-existing usage writer.
    if (!funded && orgId && typeof raw.provider === "string" && typeof raw.model === "string" && raw.usage) {
      const usageWrite = await recordAIUsageEvent({
        organizationId: orgId,
        provider: raw.provider,
        model: raw.model,
        inputTokens: raw.usage.promptTokens ?? 0,
        outputTokens: raw.usage.completionTokens ?? 0,
        externalUsageId: raw.gatewayGenerationId,
        triggeredBy: `system:${engineName}`,
        metadata: { engineName, source: "releaseops.instrumented_fetcher" },
      });
      if (!usageWrite.recorded) throw new Error("ai_usage_meter_unavailable");
    }
    await persistAiCallLog(repo, {
      organizationId: orgId,
      engineName,
      model: typeof raw.model === "string" ? raw.model : null,
      outcome: "ok",
      errorMessage: null,
      latencyMs,
      promptTokens: raw.usage?.promptTokens ?? null,
      completionTokens: raw.usage?.completionTokens ?? null,
      totalTokens: raw.usage?.totalTokens ?? null,
    });

    return {
      text: raw.text ?? "",
      modelHint: typeof raw.model === "string" ? raw.model : null,
    };
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

async function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("ai_timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
