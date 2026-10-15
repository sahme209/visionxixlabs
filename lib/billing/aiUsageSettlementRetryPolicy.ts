// Stripe API v1 may prune idempotency keys once they are 24 hours old.
// Reserve a one-hour buffer; this is a retry eligibility bound, not evidence
// that an earlier provider request failed or that its hold can be released.
const MAX_AUTOMATIC_RETRY_AGE_MS = 23 * 60 * 60 * 1000;

export function evaluateAIUsageSettlementRetry(
  record: { status: string; createdAt: Date },
  now: Date,
): "submit" | "already_submitted" | "needs_reconciliation" {
  if (record.status === "submitted") return "already_submitted";
  if (record.status !== "reserved") return "needs_reconciliation";
  const createdAt = record.createdAt instanceof Date ? record.createdAt.getTime() : NaN;
  const age = now.getTime() - createdAt;
  return Number.isFinite(age) && age >= 0 && age < MAX_AUTOMATIC_RETRY_AGE_MS
    ? "submit" : "needs_reconciliation";
}
