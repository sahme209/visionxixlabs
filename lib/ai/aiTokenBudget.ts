/**
 * AI token-budget tracker.
 *
 * Free-tier safety net: every AI call records its consumed tokens (when
 * the provider reports them) into a per-tenant rolling daily bucket.
 * Before a new call goes out, callers can `assertWithinBudget` to bail
 * out early instead of getting upstream 429s.
 *
 * The store is intentionally in-process (no Prisma write per call): the
 * AI subsystem is hot-path and we don't want to add a DB round-trip
 * just for accounting. The bucket resets at UTC midnight.
 *
 * Pure / server-only.
 */

import "server-only";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  /** UTC date key, YYYY-MM-DD. */
  dateKey: string;
  promptTokens: number;
  completionTokens: number;
  calls: number;
}

const BUCKETS = new Map<string, Bucket>();

/** Per-tenant daily caps. Tier-specific cap layered on top via tierGate. */
export interface BudgetSnapshot {
  tenantId: string;
  dateKey: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  /** True iff usage is at or above the supplied cap. */
  capped: boolean;
}

export interface BudgetCap {
  /** Cap on total tokens per day. Use Infinity for unlimited. */
  totalTokens: number;
}

export const DEFAULT_FREE_CAP: BudgetCap = { totalTokens: 200_000 };

const todayUtcKey = (now: Date = new Date()): string => {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const rollIfStale = (key: string, dateKey: string): Bucket => {
  const existing = BUCKETS.get(key);
  if (existing && existing.dateKey === dateKey) return existing;
  const fresh: Bucket = { dateKey, promptTokens: 0, completionTokens: 0, calls: 0 };
  BUCKETS.set(key, fresh);
  return fresh;
};

export function recordTokenUsage(input: {
  tenantId: string;
  promptTokens?: number;
  completionTokens?: number;
}): BudgetSnapshot {
  const dateKey = todayUtcKey();
  const b = rollIfStale(input.tenantId, dateKey);
  if (typeof input.promptTokens === "number" && input.promptTokens > 0) b.promptTokens += input.promptTokens;
  if (typeof input.completionTokens === "number" && input.completionTokens > 0) b.completionTokens += input.completionTokens;
  b.calls += 1;
  return readBudget(input.tenantId);
}

export function readBudget(tenantId: string, cap: BudgetCap = DEFAULT_FREE_CAP): BudgetSnapshot {
  const dateKey = todayUtcKey();
  const b = rollIfStale(tenantId, dateKey);
  const totalTokens = b.promptTokens + b.completionTokens;
  return {
    tenantId,
    dateKey,
    promptTokens: b.promptTokens,
    completionTokens: b.completionTokens,
    totalTokens,
    calls: b.calls,
    capped: totalTokens >= cap.totalTokens,
  };
}

export function assertWithinBudget(tenantId: string, cap: BudgetCap = DEFAULT_FREE_CAP): { ok: boolean; reason?: string; snapshot: BudgetSnapshot } {
  const snap = readBudget(tenantId, cap);
  if (snap.capped) {
    return {
      ok: false,
      reason: `daily AI token cap reached (${snap.totalTokens}/${cap.totalTokens})`,
      snapshot: snap,
    };
  }
  return { ok: true, snapshot: snap };
}

export function _clearAllBudgetsForTests(): void {
  BUCKETS.clear();
}

/** Test-only: force the date key to "yesterday" so the next call rolls. */
export function _backdateForTests(tenantId: string, daysAgo: number): void {
  const b = BUCKETS.get(tenantId);
  if (!b) return;
  const d = new Date(Date.now() - daysAgo * DAY_MS);
  b.dateKey = todayUtcKey(d);
}
