/**
 * Simple in-memory rate limiter for leads API.
 * Limit: 5 submissions per IP per hour.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkLeadsRateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }

  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count += 1;
  const remaining = Math.max(0, MAX_PER_WINDOW - entry.count);
  const ok = entry.count <= MAX_PER_WINDOW;

  return { ok, remaining };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
