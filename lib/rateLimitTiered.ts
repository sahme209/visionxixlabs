/**
 * Phase 7: Tier-based rate limiting.
 * limitKey = ${tier}:${ip}
 * Free: strict (5/min)
 * Pro: medium (15/min)
 * Growth: relaxed (30/min)
 * Enterprise: highest (60/min)
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000;

const LIMITS: Record<string, number> = {
  free: 5,
  starter: 5,
  pro: 15,
  professional: 15,
  growth: 30,
  enterprise: 60,
};

export function checkTieredRateLimit(tier: string, ip: string): boolean {
  const limit = LIMITS[tier] ?? LIMITS.free;
  const key = `${tier}:${ip}`;
  const now = Date.now();
  let times = store.get(key) || [];
  times = times.filter((t) => now - t < WINDOW_MS);
  if (times.length >= limit) return false;
  times.push(now);
  store.set(key, times);
  return true;
}
