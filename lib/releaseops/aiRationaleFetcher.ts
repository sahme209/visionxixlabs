/**
 * Phase 518 — Live AI fetcher wiring for the rationale enricher.
 *
 * Thin server-only wrapper around AIProviderManager.generateText that
 * adapts to the engine's RationaleAiFetcher contract. Keeps the engine
 * file pure (no `server-only` import) so the engine can be unit-tested
 * without a Next.js runtime.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";

/** Returns a live fetcher backed by the AI provider manager. */
export function makeLiveRationaleFetcher(): RationaleAiFetcher {
  return async (prompt) => {
    const manager = getAIProviderManager();
    const res = await manager.generateText(prompt, {
      maxTokens: 500,
      temperature: 0.2,
    });
    return {
      text: res.text ?? "",
      modelHint: typeof (res as { model?: unknown }).model === "string" ? (res as { model: string }).model : null,
    };
  };
}
