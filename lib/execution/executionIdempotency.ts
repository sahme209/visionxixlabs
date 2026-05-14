/**
 * Execution Idempotency Store.
 *
 * Supports idempotency keys for orchestration operations so an operator
 * retry doesn't accidentally start a second execution path. In-memory
 * default; swap to Prisma later.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IdempotencyStatus = "in_flight" | "succeeded" | "failed" | "expired";

export type IdempotencyOperationType =
  | "request_approval"
  | "decide_approval"
  | "create_orchestration"
  | "transition_orchestration"
  | "preflight"
  | "dry_run"
  | "desktop_handoff"
  | "verify"
  | "rollback";

export interface IdempotencyRecord {
  key: string;
  tenantId?: string;
  operationType: IdempotencyOperationType;
  sourceEntityId: string;
  status: IdempotencyStatus;
  createdAt: string;
  expiresAt: string;
  /** Reference to the persisted result (orchestration id, approval id, etc). */
  resultRef?: string;
  /** Brief error message when status is failed. */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORE = new Map<string, IdempotencyRecord>();
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function nowIso(): string { return new Date().toISOString(); }

function isExpired(rec: IdempotencyRecord, at: Date = new Date()): boolean {
  return new Date(rec.expiresAt).getTime() <= at.getTime();
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface BeginInput {
  key: string;
  tenantId?: string;
  operationType: IdempotencyOperationType;
  sourceEntityId: string;
  ttlMs?: number;
}

export type BeginResult =
  | { state: "fresh";       record: IdempotencyRecord }
  | { state: "in_flight";   record: IdempotencyRecord }
  | { state: "replay";      record: IdempotencyRecord };

export function beginOperation(input: BeginInput): BeginResult {
  const existing = STORE.get(input.key);
  if (existing && !isExpired(existing)) {
    if (existing.status === "in_flight")   return { state: "in_flight", record: existing };
    if (existing.status === "succeeded")   return { state: "replay",    record: existing };
    if (existing.status === "failed")      return { state: "replay",    record: existing };
  }

  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const record: IdempotencyRecord = {
    key: input.key,
    tenantId: input.tenantId,
    operationType: input.operationType,
    sourceEntityId: input.sourceEntityId,
    status: "in_flight",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  };
  STORE.set(input.key, record);
  return { state: "fresh", record };
}

export function completeOperation(key: string, resultRef: string): IdempotencyRecord | undefined {
  const existing = STORE.get(key);
  if (!existing) return undefined;
  const updated: IdempotencyRecord = { ...existing, status: "succeeded", resultRef };
  STORE.set(key, updated);
  return updated;
}

export function failOperation(key: string, errorMessage: string): IdempotencyRecord | undefined {
  const existing = STORE.get(key);
  if (!existing) return undefined;
  const updated: IdempotencyRecord = { ...existing, status: "failed", errorMessage: errorMessage.slice(0, 240) };
  STORE.set(key, updated);
  return updated;
}

export function getRecord(key: string): IdempotencyRecord | undefined {
  return STORE.get(key);
}

export function _resetForTests(): void {
  STORE.clear();
}
