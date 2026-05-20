/**
 * In-memory token-bucket rate limiter.
 *
 * Per-process — same trade-off the dedupe map + cron health tracker
 * make. Good enough to stop accidental hot loops; not a substitute
 * for an edge/CDN limiter under real load.
 *
 * Each bucket is keyed by an opaque string the caller provides
 * (typically `{route}:{tenantId|ip}`). The bucket starts full,
 * drains by 1 per request, refills at `tokensPerSecond` over time.
 * When empty, the next request returns `allowed:false` + a
 * retryAfterSeconds hint.
 *
 * Hard rules:
 *   - Pure: no DB, no fetch.
 *   - Per-process bounded — buckets cap at 5000 keys; oldest
 *     unused buckets evicted FIFO.
 *   - Wall-clock based. Time math uses Date.now() so the limiter
 *     stays correct across cold starts.
 */

interface Bucket {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefillAt: number;
  /** Last touch timestamp; used for eviction. */
  lastSeenAt: number;
}

const MAX_BUCKETS = 5000;
const BUCKETS = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Bucket capacity (also the burst allowance). */
  capacity: number;
  /** Tokens refilled per second. */
  tokensPerSecond: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Remaining whole tokens after this consume. */
  remaining: number;
  /** Seconds until a single token is available (0 when allowed). */
  retryAfterSeconds: number;
}

export function consumeToken(key: string, config: RateLimitConfig): RateLimitDecision {
  const now = Date.now();
  const refillPerMs = Math.max(0, config.tokensPerSecond) / 1000;

  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = {
      tokens: config.capacity,
      capacity: config.capacity,
      refillPerMs,
      lastRefillAt: now,
      lastSeenAt: now,
    };
    BUCKETS.set(key, bucket);
  } else {
    // Refill before consuming.
    const elapsed = now - bucket.lastRefillAt;
    if (elapsed > 0 && refillPerMs > 0) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.lastRefillAt = now;
    }
    // If the caller raises capacity, lift the cap.
    if (config.capacity > bucket.capacity) bucket.capacity = config.capacity;
    if (refillPerMs !== bucket.refillPerMs) bucket.refillPerMs = refillPerMs;
  }
  bucket.lastSeenAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  // No token available — compute the wait.
  const missing = 1 - bucket.tokens;
  const retryAfterSeconds = refillPerMs > 0
    ? Math.ceil(missing / (refillPerMs * 1000))
    : Number.POSITIVE_INFINITY;

  evictIfNeeded();
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60,
  };
}

export function peekBucket(key: string): { tokens: number; capacity: number } | undefined {
  const b = BUCKETS.get(key);
  if (!b) return undefined;
  return { tokens: Math.floor(b.tokens), capacity: b.capacity };
}

export function clearRateLimits(): number {
  const n = BUCKETS.size;
  BUCKETS.clear();
  return n;
}

function evictIfNeeded(): void {
  if (BUCKETS.size <= MAX_BUCKETS) return;
  // Evict the oldest-touched bucket — FIFO works as a soft LRU here
  // because lastSeenAt is updated on every consume.
  let oldestKey: string | undefined;
  let oldestAt = Number.POSITIVE_INFINITY;
  for (const [k, v] of BUCKETS) {
    if (v.lastSeenAt < oldestAt) {
      oldestAt = v.lastSeenAt;
      oldestKey = k;
    }
  }
  if (oldestKey) BUCKETS.delete(oldestKey);
}
