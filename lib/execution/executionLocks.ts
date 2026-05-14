/**
 * Execution Locks.
 *
 * Prevents unsafe duplicate work — duplicate execution plans on the same
 * resource, simultaneous approvals for conflicting actions, duplicate
 * desktop handoffs, repeated dry-runs with stale state, conflicting
 * workflows, repeated execution attempts with the same idempotency key.
 *
 * Storage is in-memory by default. Swap to Prisma when the rest of the
 * audit pipeline lands without changing the public surface.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LockKind =
  | "execution_plan"
  | "approval"
  | "desktop_handoff"
  | "dry_run"
  | "workflow_run"
  | "verification";

export interface ExecutionLock {
  id: string;
  kind: LockKind;
  /** Tenant scope. */
  tenantId?: string;
  /** Stable resource id this lock guards. */
  resourceRef: string;
  /** The action this lock represents (e.g. "restrict_public_access"). */
  action: string;
  /** Who/what holds the lock. */
  ownerId: string;
  acquiredAt: string;
  /** Locks expire after this time so failed holders don't deadlock. */
  expiresAt: string;
  /** Whether the lock was forcibly released. */
  released: boolean;
}

export interface AcquireLockInput {
  kind: LockKind;
  tenantId?: string;
  resourceRef: string;
  action: string;
  ownerId: string;
  /** TTL in ms. Default 5 minutes. */
  ttlMs?: number;
}

export interface AcquireLockResult {
  acquired: boolean;
  lock?: ExecutionLock;
  /** When `acquired` is false, the conflicting lock. */
  conflict?: ExecutionLock;
  reason: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const LOCKS = new Map<string, ExecutionLock>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function lockKey(kind: LockKind, tenantId: string | undefined, resourceRef: string, action: string): string {
  return `${kind}::${tenantId ?? "_"}::${resourceRef}::${action}`;
}

function nowIso(): string { return new Date().toISOString(); }

function isExpired(lock: ExecutionLock, at: Date = new Date()): boolean {
  return new Date(lock.expiresAt).getTime() <= at.getTime();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function acquireLock(input: AcquireLockInput): AcquireLockResult {
  const key = lockKey(input.kind, input.tenantId, input.resourceRef, input.action);
  const existing = LOCKS.get(key);
  if (existing && !existing.released && !isExpired(existing)) {
    return {
      acquired: false,
      conflict: existing,
      reason: `Lock already held by ${existing.ownerId} until ${existing.expiresAt}.`,
    };
  }
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  const lock: ExecutionLock = {
    id: `lock.${key}.${Date.now().toString(36)}`,
    kind: input.kind,
    tenantId: input.tenantId,
    resourceRef: input.resourceRef,
    action: input.action,
    ownerId: input.ownerId,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    released: false,
  };
  LOCKS.set(key, lock);
  return { acquired: true, lock, reason: "Lock acquired." };
}

export function releaseLock(lockId: string, ownerId: string): boolean {
  for (const [key, lock] of LOCKS.entries()) {
    if (lock.id !== lockId) continue;
    if (lock.ownerId !== ownerId) return false;
    LOCKS.set(key, { ...lock, released: true });
    return true;
  }
  return false;
}

export function listActiveLocks(filter: { tenantId?: string; kind?: LockKind } = {}): ExecutionLock[] {
  const out: ExecutionLock[] = [];
  for (const lock of LOCKS.values()) {
    if (lock.released) continue;
    if (isExpired(lock)) continue;
    if (filter.tenantId && lock.tenantId !== filter.tenantId) continue;
    if (filter.kind && lock.kind !== filter.kind) continue;
    out.push(lock);
  }
  return out;
}

export function _resetForTests(): void {
  LOCKS.clear();
}
