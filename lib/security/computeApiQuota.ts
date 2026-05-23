/**
 * Pure API-quota kernel — Phase 398.
 *
 * Decides whether the next v1 API call from a workspace is allowed under
 * its monthly plan budget. Closed-union QuotaDecisionKind so the route
 * can render specific 429 / blocked messages and the audit can record a
 * precise reason.
 *
 * The kernel is intentionally PURE — Postgres lookups happen at the
 * boundary in `authenticateApiKey`. The same kernel powers the v1 auth
 * gate AND a future admin "remaining budget" view, both reading the
 * same (currentCalls, monthlyLimit) tuple.
 *
 * Why monthly + per-org:
 *   - billing already runs on a monthly cycle (BillingAlert) — pairing
 *     quota with that cycle means one closed-union for both surfaces.
 *   - per-org (not per-key) so an operator can mint many keys without
 *     fragmenting their budget across them.
 *
 * Pure — no I/O.
 */

export type QuotaDecisionKind =
  | "allowed"
  | "blocked_over_monthly_limit"
  | "allowed_warning_at_threshold";

export interface QuotaDecision {
  kind: QuotaDecisionKind;
  /** True when the call is allowed to proceed. */
  allowed: boolean;
  /** Monthly limit from the plan. null = unlimited (Enterprise). */
  monthlyLimit: number | null;
  /** Current month-to-date call count (BEFORE the in-flight call). */
  currentCalls: number;
  /** Remaining calls in the window (null = unlimited). */
  remaining: number | null;
  /** 0..1 ratio of usage. null when limit is unlimited. */
  ratio: number | null;
  /**
   * When kind="blocked_over_monthly_limit" — the seconds until the
   * window resets. Suitable for the HTTP `Retry-After` header value.
   */
  retryAfterSeconds?: number;
  /** Operator-readable message for audit + UI. */
  message: string;
}

export interface ComputeQuotaInput {
  /** Calls already counted this month (excluding the in-flight one). */
  currentCalls: number;
  /** Monthly cap from the plan; null = unlimited. */
  monthlyLimit: number | null;
  /** Optional warn threshold (default 0.9 = 90%). */
  warnAtRatio?: number;
  /** "now" for retry-after computation; defaults to new Date(). */
  now?: Date;
}

const DEFAULT_WARN_AT_RATIO = 0.9;

/**
 * Compute seconds remaining until 00:00 UTC on the first of next month.
 * That's when the BillingAlert window resets, so quotas reset there too.
 */
function secondsUntilNextMonthReset(now: Date): number {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0, 0,
  ));
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function computeApiQuota(input: ComputeQuotaInput): QuotaDecision {
  const { currentCalls, monthlyLimit } = input;
  const warnAt = input.warnAtRatio ?? DEFAULT_WARN_AT_RATIO;
  const now = input.now ?? new Date();

  // Unlimited (Enterprise) — fast path.
  if (monthlyLimit === null) {
    return {
      kind: "allowed",
      allowed: true,
      monthlyLimit: null,
      currentCalls,
      remaining: null,
      ratio: null,
      message: "Unlimited quota tier.",
    };
  }

  // Defensive: a zero or negative limit means the workspace has no v1
  // budget at all on this plan. Block until the operator upgrades.
  if (monthlyLimit <= 0) {
    return {
      kind: "blocked_over_monthly_limit",
      allowed: false,
      monthlyLimit,
      currentCalls,
      remaining: 0,
      ratio: currentCalls > 0 ? 1 : 0,
      retryAfterSeconds: secondsUntilNextMonthReset(now),
      message: "This plan tier does not include any v1 API calls.",
    };
  }

  // At or over the cap → block.
  if (currentCalls >= monthlyLimit) {
    const retry = secondsUntilNextMonthReset(now);
    return {
      kind: "blocked_over_monthly_limit",
      allowed: false,
      monthlyLimit,
      currentCalls,
      remaining: 0,
      ratio: currentCalls / monthlyLimit,
      retryAfterSeconds: retry,
      message: `Monthly v1 API quota exhausted (${currentCalls}/${monthlyLimit}). Resets in ${retry}s.`,
    };
  }

  const remaining = monthlyLimit - currentCalls;
  const ratio = currentCalls / monthlyLimit;

  if (ratio >= warnAt) {
    return {
      kind: "allowed_warning_at_threshold",
      allowed: true,
      monthlyLimit,
      currentCalls,
      remaining,
      ratio,
      message: `${(ratio * 100).toFixed(1)}% of monthly v1 API quota consumed; ${remaining} call(s) remaining.`,
    };
  }

  return {
    kind: "allowed",
    allowed: true,
    monthlyLimit,
    currentCalls,
    remaining,
    ratio,
    message: `${remaining} v1 API call(s) remaining this month.`,
  };
}

/**
 * Returns the start of the current UTC month — used by the IO layer to
 * scope the UsageEvent count query and by the kernel to project the
 * reset boundary.
 */
export function currentMonthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}
