type ReconciledUsage = {
  id: string;
  organizationId: string;
  billedCents: number;
};

type SettlementBinding = {
  usageEventId: string;
  organizationId: string;
  amountCents: number;
};

/** Persisted reservations must still identify this tenant's exact reconciled
 * charge. A mismatch requires reconciliation, never automatic rebinding. */
export function isAIUsageSettlementBoundToUsage(
  usage: ReconciledUsage,
  settlement: SettlementBinding,
): boolean {
  return settlement.organizationId === usage.organizationId
    && settlement.usageEventId === usage.id
    && settlement.amountCents === usage.billedCents;
}
