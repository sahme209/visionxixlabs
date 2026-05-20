/**
 * Pure-ish idempotency-key store.
 *
 * Webhook + mutation routes can call rememberIdempotencyKey to short-
 * circuit double-deliveries within a TTL window. The store is in-
 * process only (Map) and bounded (FIFO eviction at MAX_ENTRIES).
 * Never throws.
 *
 * Pure module surface — test injects a custom now() and clears state.
 */

import "server-only";

interface Entry {
  key: string;
  scope: string;
  insertedAt: number;
  resultHash: string;
}

const MAX_ENTRIES = 5_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

const STORE = new Map<string, Entry>();

const fullKey = (scope: string, key: string): string => `${scope}::${key}`;

let _now: () => number = () => Date.now();

export function _setNowForTests(fn: () => number): void { _now = fn; }
export function _resetNowForTests(): void { _now = () => Date.now(); }
export function _clearIdempotencyStoreForTests(): void { STORE.clear(); }

function evictExpired(ttlMs: number): void {
  const cutoff = _now() - ttlMs;
  for (const [k, v] of STORE) if (v.insertedAt < cutoff) STORE.delete(k);
}

function evictExcess(): void {
  if (STORE.size <= MAX_ENTRIES) return;
  // FIFO eviction: rebuild keeping the newest MAX_ENTRIES.
  const sorted = [...STORE.entries()].sort((a, b) => b[1].insertedAt - a[1].insertedAt);
  STORE.clear();
  for (let i = 0; i < Math.min(sorted.length, MAX_ENTRIES); i++) {
    STORE.set(sorted[i][0], sorted[i][1]);
  }
}

export interface RememberResult {
  /** True iff this key was new — caller should run the side effect. */
  isNew: boolean;
  /** Previous resultHash when isNew=false; undefined when isNew=true. */
  previousResultHash?: string;
}

export function rememberIdempotencyKey(input: {
  scope: string;
  key: string;
  resultHash: string;
  ttlMs?: number;
}): RememberResult {
  const ttl = Math.max(60_000, Math.min(input.ttlMs ?? DEFAULT_TTL_MS, 7 * 24 * 60 * 60 * 1000));
  evictExpired(ttl);
  const full = fullKey(input.scope, input.key);
  const existing = STORE.get(full);
  if (existing) return { isNew: false, previousResultHash: existing.resultHash };
  STORE.set(full, { key: input.key, scope: input.scope, insertedAt: _now(), resultHash: input.resultHash });
  evictExcess();
  return { isNew: true };
}

export function readIdempotencyKey(scope: string, key: string, ttlMs: number = DEFAULT_TTL_MS): Entry | null {
  evictExpired(ttlMs);
  return STORE.get(fullKey(scope, key)) ?? null;
}

export function idempotencyStoreSize(): number { return STORE.size; }
