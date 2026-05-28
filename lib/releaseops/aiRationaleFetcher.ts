/**
 * Phase 518 — Live AI fetcher wiring for the rationale enricher.
 * Phase 531 — every fetcher is now instrumented (timing + token
 *             tracking + circuit breaker via the call log).
 *
 * Thin server-only wrapper that adapts to the engine's RationaleAiFetcher
 * contract while routing every call through the persistent log so the
 * breaker can short-circuit when the provider is sick.
 *
 * Call sites pass the engine name + (optional) org so log rows are
 * scoped correctly. Defaulting to "ad_hoc" + null preserves the
 * pre-instrumentation behavior for unscoped callers.
 */

import "server-only";
import type { RationaleAiFetcher } from "./aiRationaleEnricherEngine";
import { makeInstrumentedFetcher } from "./instrumentedAiFetcher";

/**
 * Returns a fetcher backed by the AI provider manager, with circuit
 * breaker + persistent call log applied. The `engineName` becomes the
 * scope key for stats and breaker decisions — use a stable name per
 * engine ("council_voter", "memory_chat", etc.).
 */
export function makeLiveRationaleFetcher(opts: {
  engineName?: string;
  organizationId?: string | null;
} = {}): RationaleAiFetcher {
  return makeInstrumentedFetcher({
    engineName: opts.engineName ?? "ad_hoc",
    organizationId: opts.organizationId ?? null,
  });
}
