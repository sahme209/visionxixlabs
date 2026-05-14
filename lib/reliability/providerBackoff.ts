/**
 * Provider-aware backoff schedules.
 *
 * Generic exponential backoff isn't appropriate everywhere — AWS publishes
 * rate-limit budgets, GitHub returns a `Retry-After` header, and AI providers
 * use TPM/RPM limits. Treating rate-limit responses as generic failures
 * would mask normal operational behavior.
 *
 * This module owns the per-provider knowledge:
 *  - parsing `Retry-After` / X-RateLimit-Reset
 *  - tuning base/multiplier to provider norms
 *  - capping retries so we don't spin forever
 *  - emitting a small typed envelope the workflow engine can show in the UI
 */

import type { ProviderId } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Profile per provider
// ---------------------------------------------------------------------------

export interface BackoffProfile {
  /** Minimum delay before the first retry, in ms. */
  baseMs: number;
  /** Maximum delay between retries, in ms. */
  maxMs: number;
  /** Exponent applied per attempt: delay = baseMs * multiplier^attempt. */
  multiplier: number;
  /** Random jitter percent added to each delay (0..1). */
  jitter: number;
  /** Maximum attempts the engine will make. */
  maxAttempts: number;
}

const PROFILES: Partial<Record<ProviderId, BackoffProfile>> = {
  aws:    { baseMs: 1_000, maxMs: 60_000, multiplier: 2, jitter: 0.2, maxAttempts: 5 },
  azure:  { baseMs: 1_500, maxMs: 60_000, multiplier: 2, jitter: 0.2, maxAttempts: 5 },
  gcp:    { baseMs: 1_000, maxMs: 60_000, multiplier: 2, jitter: 0.2, maxAttempts: 5 },
  github: { baseMs: 2_000, maxMs: 120_000, multiplier: 2, jitter: 0.15, maxAttempts: 4 },
  // AI / notification providers — conservative
  servicenow: { baseMs: 5_000, maxMs: 60_000, multiplier: 2, jitter: 0.1, maxAttempts: 3 },
  pagerduty:  { baseMs: 3_000, maxMs: 30_000, multiplier: 2, jitter: 0.1, maxAttempts: 4 },
  slack:      { baseMs: 1_000, maxMs: 30_000, multiplier: 2, jitter: 0.1, maxAttempts: 4 },
};

const FALLBACK: BackoffProfile = { baseMs: 1_000, maxMs: 30_000, multiplier: 2, jitter: 0.2, maxAttempts: 4 };

export function profileFor(provider: ProviderId): BackoffProfile {
  return PROFILES[provider] ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// Compute next delay
// ---------------------------------------------------------------------------

export interface BackoffOutcome {
  delayMs: number;
  attempt: number;
  attemptsRemaining: number;
  /** Whether the engine should stop retrying after this attempt. */
  exhausted: boolean;
  /** Honest reason — usable in workflow detail panels. */
  reason: string;
}

/**
 * Compute the delay for the next retry. `attempt` is the count of failures
 * so far (0 means we're computing the first retry after the first failure).
 *
 * If the provider passed `retryAfterSeconds` (from headers), we honour it —
 * the provider knows better than us. Otherwise we use the profile schedule.
 */
export function computeBackoff(input: {
  provider: ProviderId;
  attempt: number;
  retryAfterSeconds?: number;
}): BackoffOutcome {
  const profile = profileFor(input.provider);
  if (input.attempt >= profile.maxAttempts) {
    return {
      delayMs: 0,
      attempt: input.attempt,
      attemptsRemaining: 0,
      exhausted: true,
      reason: `Exhausted ${profile.maxAttempts} retries for ${input.provider}.`,
    };
  }
  let delayMs: number;
  let reason: string;
  if (input.retryAfterSeconds !== undefined && input.retryAfterSeconds > 0) {
    delayMs = Math.min(profile.maxMs, Math.floor(input.retryAfterSeconds * 1000));
    reason = `Honouring ${input.provider} Retry-After: ${input.retryAfterSeconds}s.`;
  } else {
    const base = profile.baseMs * Math.pow(profile.multiplier, input.attempt);
    const withJitter = base + Math.random() * base * profile.jitter;
    delayMs = Math.min(profile.maxMs, Math.floor(withJitter));
    reason = `Provider backoff: attempt ${input.attempt + 1}/${profile.maxAttempts} in ${Math.round(delayMs / 1000)}s.`;
  }
  return {
    delayMs,
    attempt: input.attempt + 1,
    attemptsRemaining: profile.maxAttempts - (input.attempt + 1),
    exhausted: false,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Header parsers — boundary helpers for connectors
// ---------------------------------------------------------------------------

/**
 * Parse the `Retry-After` header into seconds. Header may be either a delta
 * in seconds or an HTTP-date.
 */
export function parseRetryAfter(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const asNum = Number(header);
  if (Number.isFinite(asNum) && asNum >= 0) return asNum;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const secs = Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
    return secs;
  }
  return undefined;
}

/**
 * Parse `X-RateLimit-Reset` (GitHub) — Unix seconds. Returns delta in seconds.
 */
export function parseGithubRateLimitReset(header: string | null | undefined, now: Date = new Date()): number | undefined {
  if (!header) return undefined;
  const resetUnix = Number(header);
  if (!Number.isFinite(resetUnix) || resetUnix <= 0) return undefined;
  return Math.max(0, resetUnix - Math.floor(now.getTime() / 1000));
}
