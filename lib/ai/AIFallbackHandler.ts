/**
 * AIFallbackHandler — pure ordering + retry-or-skip logic.
 *
 * Given a candidate provider chain (already filtered to configured
 * providers by the manager), decide which provider to try next and
 * whether the previous failure was retryable.
 *
 * Pure — easy to unit test. Manager invokes runWithFallback below.
 */

import { AIProviderError, type AIProvider, type AIProviderName, type AITaskKind } from "./AIProvider";
import { recordUsage } from "./AIUsageLogger";

export interface FallbackOutcome<T> {
  result: T;
  provider: AIProviderName;
  model: string;
  /** Providers that failed before the winner, with the reason. */
  attempts: Array<{ provider: AIProviderName; ok: boolean; errorKind?: string; latencyMs: number }>;
}

const TASK_OF: AITaskKind = "generate_text"; // default tag for the logger; manager overrides

/**
 * Run `fn(provider)` against each configured provider in order. Stops
 * at the first success. Returns a structured outcome with per-attempt
 * details so the UI / logs can show which provider ultimately served
 * the request.
 *
 * The function MUST throw AIProviderError on failure; any other throw
 * is treated as bad_response (and is logged with that error kind).
 */
export async function runWithFallback<T>(
  providers: readonly AIProvider[],
  fn: (provider: AIProvider) => Promise<T & { provider: AIProviderName; model: string; latencyMs: number }>,
  opts?: { task?: AITaskKind; correlationId?: string },
): Promise<FallbackOutcome<T>> {
  const attempts: FallbackOutcome<T>["attempts"] = [];
  if (providers.length === 0) {
    throw new AIProviderError({ provider: "mock", kind: "not_configured", message: "no providers available" });
  }
  let lastErr: AIProviderError | null = null;
  for (const p of providers) {
    try {
      const r = await fn(p);
      attempts.push({ provider: p.name, ok: true, latencyMs: r.latencyMs });
      recordUsage({
        provider: r.provider, model: r.model, task: opts?.task ?? TASK_OF,
        latencyMs: r.latencyMs, status: "ok", correlationId: opts?.correlationId,
      });
      return { result: r, provider: r.provider, model: r.model, attempts };
    } catch (err) {
      const e =
        err instanceof AIProviderError
          ? err
          : new AIProviderError({ provider: p.name, kind: "bad_response", message: "unexpected error" });
      lastErr = e;
      attempts.push({ provider: p.name, ok: false, errorKind: e.kind, latencyMs: e.latencyMs });
      recordUsage({
        provider: p.name, model: p.defaultModel, task: opts?.task ?? TASK_OF,
        latencyMs: e.latencyMs, status: "error", errorKind: e.kind, correlationId: opts?.correlationId,
      });
      if (!shouldTryNext(e)) {
        // not_configured + retryable transport errors all let us try the next
        // provider; truly fatal kinds also fall through to "try next" since
        // a different provider may succeed.
        continue;
      }
    }
  }
  throw lastErr ?? new AIProviderError({ provider: "mock", kind: "unknown", message: "all providers failed" });
}

/**
 * Used by tests to verify the policy. Currently always returns true —
 * we ALWAYS try the next provider after a failure (the mock provider is
 * the last in the chain, so we converge on a deterministic answer).
 * Kept as a named function so future policy refinements have a clear
 * seam.
 */
export function shouldTryNext(_err: AIProviderError): boolean {
  return true;
}
