/**
 * Phase 531 — AI call log engine.
 *
 * Pure functions only:
 *   • computeCircuitState — canonical 3-state breaker over a window
 *     of recent outcomes
 *   • computeEngineStats — latency p50/p95 + outcome counts + token
 *     totals over a window
 *   • shouldShortCircuit — convenience predicate used by the fetcher
 *     wrapper
 *
 * No I/O, no `server-only` import. The persistence layer (responder
 * + repo) consumes these helpers. Tests exercise the state machine
 * directly without any DB stubs.
 *
 * Circuit breaker semantics:
 *   closed     — calls flow normally
 *   open       — calls short-circuit immediately. Cools down for
 *                cooldownMs after the *most recent* error window.
 *   half_open  — cooldown elapsed. The next call is allowed; if it
 *                succeeds the breaker closes, if it errors the
 *                breaker re-opens with a fresh cooldown.
 *
 * The state is derived (computed each call from persisted outcomes)
 * — there's no in-memory state to keep coherent across instances.
 */

export const AI_CALL_OUTCOMES = ["ok", "error", "timeout", "short_circuit"] as const;
export type AiCallOutcome = (typeof AI_CALL_OUTCOMES)[number];

export const CIRCUIT_STATES = ["closed", "open", "half_open"] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export interface CircuitConfig {
  /** Number of recent calls to consider when deciding. Default 10. */
  windowSize: number;
  /** Errors within the window that flip the breaker open. Default 3. */
  errorThreshold: number;
  /** Milliseconds the breaker stays open before half-open. Default 60_000. */
  cooldownMs: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  windowSize: 10,
  errorThreshold: 3,
  cooldownMs: 60_000,
};

export interface OutcomeRow {
  outcome: string;
  startedAt: Date;
}

/**
 * Compute the breaker state given the most-recent outcomes
 * (newest-first). short_circuit rows are ignored — they represent
 * the breaker's own actions, not provider signal.
 */
export function computeCircuitState(
  outcomesNewestFirst: OutcomeRow[],
  now: Date,
  config: Partial<CircuitConfig> = {},
): CircuitState {
  const cfg: CircuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  // Filter out short_circuit rows — they're not provider observations.
  const window = outcomesNewestFirst.filter((r) => r.outcome !== "short_circuit").slice(0, cfg.windowSize);

  if (window.length === 0) return "closed";

  // Count failures in the window.
  const failures = window.filter((r) => r.outcome === "error" || r.outcome === "timeout");
  if (failures.length < cfg.errorThreshold) return "closed";

  // Above threshold — breaker has been tripped. Determine open vs
  // half_open based on time since the most recent failure.
  const mostRecentFailure = failures[0];
  const sinceFailMs = now.getTime() - mostRecentFailure.startedAt.getTime();
  if (sinceFailMs < cfg.cooldownMs) return "open";

  // Cooldown elapsed: half_open until the next call resolves.
  return "half_open";
}

export function shouldShortCircuit(state: CircuitState): boolean {
  return state === "open";
}

/* ──────────────────────────────────────────────────────────────────
   Stats over the call log.
   ────────────────────────────────────────────────────────────── */

export interface CallSummary {
  outcome: string;
  latencyMs: number;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface EngineStats {
  windowSize: number;
  okCount: number;
  errorCount: number;
  timeoutCount: number;
  shortCircuitCount: number;
  /** p50 latency ms over ok+error+timeout (not short_circuit). */
  latencyP50Ms: number;
  /** p95 latency ms over ok+error+timeout. */
  latencyP95Ms: number;
  /** Total prompt tokens summed across the window. */
  promptTokensTotal: number;
  /** Total completion tokens summed across the window. */
  completionTokensTotal: number;
  /** Successful-call ratio (ok / (ok+error+timeout)). */
  successRate: number;
}

export function computeEngineStats(calls: CallSummary[]): EngineStats {
  let okCount = 0;
  let errorCount = 0;
  let timeoutCount = 0;
  let shortCircuitCount = 0;
  let promptTokensTotal = 0;
  let completionTokensTotal = 0;
  const latencies: number[] = [];

  for (const c of calls) {
    if (c.outcome === "ok") okCount++;
    else if (c.outcome === "error") errorCount++;
    else if (c.outcome === "timeout") timeoutCount++;
    else if (c.outcome === "short_circuit") shortCircuitCount++;
    if (c.outcome !== "short_circuit") latencies.push(c.latencyMs);
    if (typeof c.promptTokens === "number") promptTokensTotal += c.promptTokens;
    if (typeof c.completionTokens === "number") completionTokensTotal += c.completionTokens;
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const latencyP50Ms = percentile(sorted, 0.5);
  const latencyP95Ms = percentile(sorted, 0.95);
  const providerCount = okCount + errorCount + timeoutCount;
  const successRate = providerCount === 0 ? 0 : okCount / providerCount;

  return {
    windowSize: calls.length,
    okCount,
    errorCount,
    timeoutCount,
    shortCircuitCount,
    latencyP50Ms,
    latencyP95Ms,
    promptTokensTotal,
    completionTokensTotal,
    successRate,
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  // Nearest-rank percentile — simple and stable.
  const rank = Math.max(0, Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length)));
  return sortedAsc[rank];
}

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

export function isAiCallOutcome(s: string): s is AiCallOutcome {
  return (AI_CALL_OUTCOMES as readonly string[]).includes(s);
}

export function isCircuitState(s: string): s is CircuitState {
  return (CIRCUIT_STATES as readonly string[]).includes(s);
}
