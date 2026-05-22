/**
 * Provider rate seeds — Phase 381.
 *
 * Reference rates for OpenAI + Anthropic models the platform actively
 * uses. Rates are NOT hardcoded as the cost path's source of truth —
 * the source of truth is the AIProviderRate Prisma table, which an
 * operator can edit. This seed file is what gets written into the
 * table on first boot (idempotent upsert) and exists so a fresh
 * install has sane defaults.
 *
 * Effective dates are tagged. When a vendor rate changes, expire the
 * old row by setting effectiveTo and insert a new row — never mutate
 * an existing rate in place (the cost history must be reconstructable).
 *
 * Values below are list rates as of 2026-04-15 per Anthropic's published
 * pricing and OpenAI's GPT-4o family. Cents per million tokens.
 */

export interface ProviderRateSeed {
  provider: "anthropic" | "openai";
  modelId: string;
  displayName: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
  cachedReadCentsPerMillion: number | null;
  batchInputCentsPerMillion: number | null;
  batchOutputCentsPerMillion: number | null;
  effectiveFrom: string; // ISO date
  notes?: string;
}

export const PROVIDER_RATE_SEEDS: ReadonlyArray<ProviderRateSeed> = [
  // ---- Anthropic ----
  {
    provider: "anthropic",
    modelId: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    inputCentsPerMillion: 500,
    outputCentsPerMillion: 2500,
    cachedReadCentsPerMillion: 50,
    batchInputCentsPerMillion: null,
    batchOutputCentsPerMillion: null,
    effectiveFrom: "2026-04-01",
    notes: "Most capable Claude. 1M context. Long-context tier at standard rates.",
  },
  {
    provider: "anthropic",
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    inputCentsPerMillion: 500,
    outputCentsPerMillion: 2500,
    cachedReadCentsPerMillion: 50,
    batchInputCentsPerMillion: null,
    batchOutputCentsPerMillion: null,
    effectiveFrom: "2025-11-01",
  },
  {
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    inputCentsPerMillion: 300,
    outputCentsPerMillion: 1500,
    cachedReadCentsPerMillion: 30,
    batchInputCentsPerMillion: 150,
    batchOutputCentsPerMillion: 750,
    effectiveFrom: "2025-09-01",
    notes: "Best balance for coding workloads — the default for AI coding loop (Phase 380).",
  },
  {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    inputCentsPerMillion: 100,
    outputCentsPerMillion: 500,
    cachedReadCentsPerMillion: 10,
    batchInputCentsPerMillion: 50,
    batchOutputCentsPerMillion: 250,
    effectiveFrom: "2025-10-01",
    notes: "Cheap + fast. Default for classification, summarization, lightweight agent runs.",
  },
  // ---- OpenAI (for parity if the operator wants OpenAI routing) ----
  {
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    inputCentsPerMillion: 250,
    outputCentsPerMillion: 1000,
    cachedReadCentsPerMillion: 125,
    batchInputCentsPerMillion: 125,
    batchOutputCentsPerMillion: 500,
    effectiveFrom: "2024-12-01",
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    inputCentsPerMillion: 15,
    outputCentsPerMillion: 60,
    cachedReadCentsPerMillion: 7,
    batchInputCentsPerMillion: 7,
    batchOutputCentsPerMillion: 30,
    effectiveFrom: "2024-07-18",
  },
];

/** Find a seed by (provider, modelId). Used by the route layer when the DB is empty. */
export function findSeedRate(provider: string, modelId: string): ProviderRateSeed | null {
  return PROVIDER_RATE_SEEDS.find((r) => r.provider === provider && r.modelId === modelId) ?? null;
}
