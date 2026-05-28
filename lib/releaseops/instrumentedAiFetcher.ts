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
import { prisma } from "@/lib/db";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";
import {
  lookupCircuitState,
  persistAiCallLog,
  type AiCallLogRepo,
} from "./aiCallLogResponder";
import { shouldShortCircuit, type CircuitConfig } from "./aiCallLogEngine";

export interface InstrumentedFetcherOptions {
  /** Engine name for log + circuit scope. Stored on every row. */
  engineName: string;
  /** Optional org for scoping log rows. Null when unscoped (cron). */
  organizationId?: string | null;
  /** Override breaker thresholds — engineers may tune per engine. */
  circuitConfig?: Partial<CircuitConfig>;
  /** Provider call timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Override the AI provider manager (testing). Defaults to live. */
  generateText?: (prompt: string, opts: { maxTokens: number; temperature: number }) => Promise<unknown>;
  /** Wall-clock provider for tests. */
  now?: () => Date;
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
    let raw: { text: string; model: string; usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null };
    try {
      const generate = opts.generateText ?? ((p, o) => getAIProviderManager().generateText(p, o));
      const result = await raceWithTimeout(generate(prompt, { maxTokens: 500, temperature: 0.2 }), timeoutMs);
      raw = result as typeof raw;
    } catch (err) {
      const latencyMs = now().getTime() - startMs;
      const isTimeout = err instanceof Error && err.message === "ai_timeout";
      await persistAiCallLog(repo, {
        organizationId: orgId,
        engineName,
        model: null,
        outcome: isTimeout ? "timeout" : "error",
        errorMessage: err instanceof Error ? err.message : "unknown",
        latencyMs,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
      throw err;
    }

    const latencyMs = now().getTime() - startMs;
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
