/**
 * Pure rate-limit budget (sliding-window counter).
 *
 * Bookkeeping for per-key burst rates. Caller picks the window length
 * and budget; we track per-key timestamps in a bounded ring. Never
 * touches the network; never persists.
 *
 * Pure module surface; test injects a custom now().
 */

export interface RateLimitOptions {
  /** Window length in ms (default 60_000 = 1 minute). */
  windowMs?: number;
  /** Max allowed requests in the window. */
  budget: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** ms until the oldest timestamp in the window falls off. */
  retryAfterMs: number;
}

const STORE = new Map<string, number[]>();

let _now: () => number = () => Date.now();

export function _setNowForTests(fn: () => number): void { _now = fn; }
export function _resetNowForTests(): void { _now = () => Date.now(); }
export function _clearRateLimitStoreForTests(): void { STORE.clear(); }

function prune(arr: number[], cutoff: number): number[] {
  // arr is kept sorted asc by insertion order (we only push current now()).
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i += 1;
  return i === 0 ? arr : arr.slice(i);
}

/**
 * Consume one slot for `key`. Returns whether the call is allowed +
 * how many remaining in the current window.
 */
export function consumeRateLimit(key: string, opts: RateLimitOptions): RateLimitDecision {
  const windowMs = Math.max(1_000, opts.windowMs ?? 60_000);
  const budget = Math.max(1, opts.budget);
  const now = _now();
  const cutoff = now - windowMs;

  const existing = STORE.get(key) ?? [];
  const pruned = prune(existing, cutoff);

  if (pruned.length >= budget) {
    const oldest = pruned[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    STORE.set(key, pruned);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  pruned.push(now);
  STORE.set(key, pruned);
  return { allowed: true, remaining: budget - pruned.length, retryAfterMs: 0 };
}

/** Read remaining without consuming. */
export function peekRateLimit(key: string, opts: RateLimitOptions): RateLimitDecision {
  const windowMs = Math.max(1_000, opts.windowMs ?? 60_000);
  const budget = Math.max(1, opts.budget);
  const now = _now();
  const cutoff = now - windowMs;
  const pruned = prune(STORE.get(key) ?? [], cutoff);
  if (pruned.length >= budget) {
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, pruned[0] + windowMs - now) };
  }
  return { allowed: true, remaining: budget - pruned.length, retryAfterMs: 0 };
}
