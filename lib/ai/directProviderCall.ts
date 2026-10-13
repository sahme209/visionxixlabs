/**
 * Direct provider call — Phase 593.
 *
 * Sits next to Phase 383's routeAITask. Where routeAITask DECIDES
 * which (provider, model) is right for a task kind, this module
 * Compatibility adapter for older per-engineer routing call sites.
 * Production inference is always executed through AIProviderManager,
 * whose only runtime provider is Vercel AI Gateway. The legacy provider
 * argument is retained so older callers do not require an unsafe flag-day
 * migration; it never selects or contacts a direct provider.
 *
 * Returns the same { text, model, usage } shape the instrumented
 * fetcher's persistAiCallLog expects.
 *
 * Server-only.
 */

import "server-only";

import { getAIProviderManager } from "./AIProviderManager";

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
  _provider: PreferredProvider,
  prompt: string,
  opts: DirectCallOpts,
): Promise<DirectCallResult> {
  const r = await getAIProviderManager().generateText(prompt, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    only: "vercel_gateway",
  });
  return {
    text: r.text ?? "",
    model: r.model,
    usage: r.usage,
  };
}
