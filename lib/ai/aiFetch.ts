/**
 * Tiny shared HTTP helper for AI providers.
 *
 * Centralizes:
 *   - timeout (AbortController)
 *   - error classification (rate-limit, invalid key, model unavailable,
 *     network, timeout)
 *   - never logging request bodies or secrets
 */

import "server-only";
import { AIProviderError, type AIProviderName } from "./AIProvider";

export interface AIFetchOptions {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  provider: AIProviderName;
}

export async function aiFetch(opts: AIFetchOptions): Promise<{ res: Response; latencyMs: number }> {
  const ctrl = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(opts.url, {
      method: opts.method ?? "POST",
      headers: { "content-type": "application/json", ...opts.headers },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      throw classifyHttpError({ provider: opts.provider, status: res.status, latencyMs });
    }
    return { res, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    if (err instanceof AIProviderError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AIProviderError({ provider: opts.provider, kind: "timeout", message: `timeout after ${timeoutMs}ms`, retryable: true, latencyMs });
    }
    throw new AIProviderError({ provider: opts.provider, kind: "network", message: "network error", retryable: true, latencyMs });
  } finally {
    clearTimeout(timer);
  }
}

export function classifyHttpError(input: { provider: AIProviderName; status: number; latencyMs: number }): AIProviderError {
  const { provider, status, latencyMs } = input;
  if (status === 401 || status === 403) {
    return new AIProviderError({ provider, kind: "invalid_key", message: `auth failed (${status})`, retryable: false, latencyMs });
  }
  if (status === 404) {
    return new AIProviderError({ provider, kind: "model_unavailable", message: `not found (${status})`, retryable: false, latencyMs });
  }
  if (status === 429) {
    return new AIProviderError({ provider, kind: "rate_limited", message: `rate limited (${status})`, retryable: true, latencyMs });
  }
  if (status >= 500) {
    return new AIProviderError({ provider, kind: "network", message: `upstream error (${status})`, retryable: true, latencyMs });
  }
  return new AIProviderError({ provider, kind: "bad_response", message: `http ${status}`, retryable: false, latencyMs });
}

/** Wrap an arbitrary JSON.parse to never throw — returns null on failure. */
export function safeJson<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

/** Strip ```json fences and any leading/trailing prose from a model response. */
export function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1].trim();
  // Find the first `{` or `[` and slice to its matching brace (best-effort).
  const i = text.search(/[{\[]/);
  if (i < 0) return text.trim();
  let depth = 0;
  const open = text[i];
  const close = open === "{" ? "}" : "]";
  for (let j = i; j < text.length; j++) {
    if (text[j] === open) depth += 1;
    else if (text[j] === close) {
      depth -= 1;
      if (depth === 0) return text.slice(i, j + 1);
    }
  }
  return text.slice(i).trim();
}
