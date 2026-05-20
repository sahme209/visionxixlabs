/**
 * Transient cloud-error retry helper.
 *
 * Wraps any async function with bounded exponential-backoff retries.
 * Designed for AWS/Azure/GCP SDK calls that occasionally return
 * 429/Throttling/5xx but succeed on retry within seconds.
 *
 * Hard rules:
 *   - At most `maxAttempts` total tries (caller chooses; default 3).
 *   - Only retry when the classifier deems the error transient.
 *     Auth + validation errors NEVER retry — they're permanent.
 *   - Backoff: base * 2^(attempt-1) + jitter, capped at maxDelayMs.
 *   - Pure: no logging side-effects (callers can wrap with their own
 *     observability if needed).
 */

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Base delay before the first retry. Default 200ms. */
  baseDelayMs?: number;
  /** Cap for any single backoff. Default 5000ms. */
  maxDelayMs?: number;
  /** Caller-supplied transient classifier. Defaults to the heuristic in `isTransientError`. */
  isTransient?: (err: unknown) => boolean;
  /** Jitter strategy. Default: ±25% multiplicative. */
  jitter?: (delayMs: number) => number;
}

export interface RetryAttempt {
  attempt: number;
  durationMs: number;
  errored: boolean;
  error?: string;
}

export interface RetryOutcome<T> {
  ok: boolean;
  value?: T;
  attempts: RetryAttempt[];
  /** When ok=false, the final error message. */
  finalError?: string;
}

export async function retryTransient<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<RetryOutcome<T>> {
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, opts?.baseDelayMs ?? 200);
  const maxDelayMs = Math.max(baseDelayMs, opts?.maxDelayMs ?? 5_000);
  const classifier = opts?.isTransient ?? isTransientError;
  const jitter = opts?.jitter ?? defaultJitter;

  const attempts: RetryAttempt[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = Date.now();
    try {
      const value = await fn();
      attempts.push({ attempt, durationMs: Date.now() - start, errored: false });
      return { ok: true, value, attempts };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ attempt, durationMs: Date.now() - start, errored: true, error: message.slice(0, 240) });

      // Permanent error — fail fast.
      if (!classifier(err)) {
        return { ok: false, attempts, finalError: message };
      }
      // Last attempt — give up.
      if (attempt >= maxAttempts) {
        return { ok: false, attempts, finalError: message };
      }
      // Otherwise back off and retry.
      const raw = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delay = Math.max(0, Math.floor(jitter(raw)));
      await sleep(delay);
    }
  }

  return { ok: false, attempts, finalError: "Exhausted retries" };
}

// ---------------------------------------------------------------------------
// Transient classifier
// ---------------------------------------------------------------------------

/** Catch-all heuristic — works against most AWS/Azure/GCP SDK error shapes. */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  // Status codes set by all three SDK families on the error object.
  const e = err as { $metadata?: { httpStatusCode?: number }; statusCode?: number; code?: string | number; name?: string };
  const status = e.$metadata?.httpStatusCode ?? e.statusCode;
  if (typeof status === "number") {
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500 && status <= 599) return true;
  }
  const code = String(e.code ?? "").toLowerCase();
  if (code === "throttling" || code === "throttlingexception" || code === "requestthrottled") return true;
  if (code === "etimedout" || code === "econnreset" || code === "econnrefused") return true;
  if (code === "epipe" || code === "enotfound") return true;
  const name = String(e.name ?? "").toLowerCase();
  if (name.includes("throttl") || name.includes("timeout") || name.includes("temporary")) return true;
  // Plain string match as a last resort.
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (message.includes("rate exceeded") || message.includes("too many requests")) return true;
  if (message.includes("service unavailable") || message.includes("internal server error")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultJitter(delayMs: number): number {
  const min = delayMs * 0.75;
  const max = delayMs * 1.25;
  return min + Math.random() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
