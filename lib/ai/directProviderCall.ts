/**
 * Direct provider call — Phase 593.
 *
 * Sits next to Phase 383's routeAITask. Where routeAITask DECIDES
 * which (provider, model) is right for a task kind, this module
 * EXECUTES the call directly against the chosen provider, bypassing
 * the AIProviderManager fallback chain.
 *
 * Why bypass? Per-engineer routing wants explicit cost control —
 * an engineer that picked openai/gpt-4o-mini for high-volume
 * classification doesn't want the manager to silently fail-over to
 * a more expensive provider. If the chosen provider is down, the
 * instrumented fetcher's circuit breaker handles graceful
 * degradation honestly.
 *
 * Returns the same { text, model, usage } shape the instrumented
 * fetcher's persistAiCallLog expects.
 *
 * Server-only.
 */

import "server-only";

import { generateText as anthropicGenerate } from "./providers/anthropic";
import { generateText as openaiGenerate } from "./providers/openai";

export type PreferredProvider = "anthropic" | "openai";

export interface DirectCallResult {
  text: string;
  model: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
}

export interface DirectCallOpts {
  maxTokens: number;
  temperature: number;
}

export async function callProvider(
  provider: PreferredProvider,
  prompt: string,
  opts: DirectCallOpts,
): Promise<DirectCallResult> {
  if (provider === "openai") {
    const r = await openaiGenerate({ prompt, maxTokens: opts.maxTokens, temperature: opts.temperature });
    // The openai provider doesn't return the resolved model string,
    // so we read the same env var it consulted. Stays in sync with
    // the provider source of truth.
    const model = process.env.OPENAI_MODEL?.trim() || process.env.MODEL_NAME?.trim() || "gpt-4o";
    return {
      text: r.text ?? "",
      model,
      usage: r.usage
        ? { promptTokens: r.usage.inputTokens, completionTokens: r.usage.outputTokens }
        : null,
    };
  }
  // Default: anthropic.
  const r = await anthropicGenerate({ prompt, maxTokens: opts.maxTokens, temperature: opts.temperature });
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
  return {
    text: r.text ?? "",
    model,
    usage: r.usage
      ? { promptTokens: r.usage.inputTokens, completionTokens: r.usage.outputTokens }
      : null,
  };
}
