/**
 * Pure invocation cost calculator — Phase 381.
 *
 * Given token counts + a provider-rate row, compute the cost in cents
 * (USD). All math is integer; no float drift. Cached-read tokens are
 * billed at the cachedReadCentsPerMillion rate when supplied; absent
 * cached-read pricing falls back to the regular input rate.
 *
 * Lives in lib/billing so it can be unit-tested without Prisma. The
 * route layer fetches an AIProviderRate row and passes it here.
 */

export interface ProviderRate {
  provider: string;
  modelId: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
  cachedReadCentsPerMillion: number | null;
  batchInputCentsPerMillion?: number | null;
  batchOutputCentsPerMillion?: number | null;
}

export interface InvocationUsage {
  inputTokens: number;
  outputTokens: number;
  cachedReadTokens?: number;
  /** When true, batch rates are used if present on the rate row. */
  isBatch?: boolean;
}

export interface CostBreakdown {
  totalCents: number;
  inputCents: number;
  outputCents: number;
  cachedReadCents: number;
  /** True when batch rates were applied. */
  appliedBatchRate: boolean;
}

/** Integer math: cost = ceil(tokens * cents / 1_000_000). Avoids float drift. */
function tokensTimesRate(tokens: number, centsPerMillion: number): number {
  if (tokens <= 0 || centsPerMillion <= 0) return 0;
  // ceil(a/b) === Math.floor((a + b - 1) / b) for positive integers
  return Math.floor((tokens * centsPerMillion + 999_999) / 1_000_000);
}

export function computeInvocationCost(
  usage: InvocationUsage,
  rate: ProviderRate,
): CostBreakdown {
  const inputTokens = Math.max(0, Math.floor(usage.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(usage.outputTokens || 0));
  const cachedReadTokens = Math.max(0, Math.floor(usage.cachedReadTokens || 0));

  // Cached reads don't double-count — assume the caller already subtracted
  // cached tokens from inputTokens (matches Anthropic's usage report shape:
  // input_tokens + cache_read_input_tokens are disjoint).
  const useBatch = Boolean(
    usage.isBatch &&
    rate.batchInputCentsPerMillion != null &&
    rate.batchOutputCentsPerMillion != null,
  );

  const inputRate = useBatch && rate.batchInputCentsPerMillion != null
    ? rate.batchInputCentsPerMillion
    : rate.inputCentsPerMillion;
  const outputRate = useBatch && rate.batchOutputCentsPerMillion != null
    ? rate.batchOutputCentsPerMillion
    : rate.outputCentsPerMillion;
  const cachedRate = rate.cachedReadCentsPerMillion ?? rate.inputCentsPerMillion;

  const inputCents = tokensTimesRate(inputTokens, inputRate);
  const outputCents = tokensTimesRate(outputTokens, outputRate);
  const cachedReadCents = tokensTimesRate(cachedReadTokens, cachedRate);

  return {
    totalCents: inputCents + outputCents + cachedReadCents,
    inputCents,
    outputCents,
    cachedReadCents,
    appliedBatchRate: useBatch,
  };
}

/**
 * Pretty-print cents → "$x.xx" for the operator UI. Negative inputs
 * become $0.00 (defensive — should never happen on cost output).
 */
export function formatCents(cents: number): string {
  if (cents <= 0) return "$0.00";
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `$${dollars}.${remainder.toString().padStart(2, "0")}`;
}
