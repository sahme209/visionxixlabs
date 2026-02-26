const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

/**
 * Simple in-memory rate limit. Returns true if allowed, false if rate limited.
 * Key by token or IP. Resets after WINDOW_MS.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let times = store.get(key) || [];
  times = times.filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_REQUESTS) return false;
  times.push(now);
  store.set(key, times);
  return true;
}
