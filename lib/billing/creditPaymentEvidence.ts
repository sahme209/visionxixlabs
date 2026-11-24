/** Checkout fulfillment records application after verifying the actual payment. */
export function hasAppliedCreditPayment(purchase: { appliedAt: Date | null }): boolean {
  return purchase.appliedAt instanceof Date && Number.isFinite(purchase.appliedAt.getTime());
}
