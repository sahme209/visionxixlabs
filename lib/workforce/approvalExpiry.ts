/**
 * Approval expiry policy — Phase 370.
 *
 * Pending engineer-sourced approvals should not sit forever. A stale
 * approval that suddenly fires days after staging is a security
 * regression — the planning context that produced it is long gone.
 *
 * This module is the pure decision layer: given a snapshot and the
 * current time, decide whether it should be transitioned to
 * "expired". The cron sweeper at /api/cron/sweep-engineer-approvals
 * is the imperative caller.
 */

/** Default expiry: 24 hours. Override per-call when the env supplies a tighter window. */
export const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

/** Bounds: refuse to sweep in < 5 minutes (too aggressive) or > 14 days (defeats the point). */
export const MIN_APPROVAL_TTL_MS = 5 * 60 * 1000;
export const MAX_APPROVAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface ExpiryCandidate {
  status: string;
  createdAt: Date;
}

/**
 * True when a snapshot is still pending and older than the TTL. The
 * status check defends against accidentally re-expiring an already-
 * decided row (which would corrupt the audit trail).
 */
export function isApprovalExpired(
  snapshot: ExpiryCandidate,
  now: Date,
  ttlMs: number = DEFAULT_APPROVAL_TTL_MS,
): boolean {
  if (snapshot.status !== "pending") return false;
  if (ttlMs < MIN_APPROVAL_TTL_MS) return false;
  if (ttlMs > MAX_APPROVAL_TTL_MS) return false;
  const ageMs = now.getTime() - snapshot.createdAt.getTime();
  return ageMs >= ttlMs;
}

/**
 * Resolve the TTL from a (string-typed) env value. Returns the
 * default when the value is missing, malformed, or out of bounds —
 * the sweeper should never refuse to run because of a typo.
 */
export function resolveApprovalTtlMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_APPROVAL_TTL_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_APPROVAL_TTL_MS;
  if (parsed < MIN_APPROVAL_TTL_MS) return DEFAULT_APPROVAL_TTL_MS;
  if (parsed > MAX_APPROVAL_TTL_MS) return DEFAULT_APPROVAL_TTL_MS;
  return parsed;
}
