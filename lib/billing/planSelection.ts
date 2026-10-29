import { isBillingInterval, isPaidPublicPlanId, type BillingInterval, type PaidPublicPlanId } from "./publicPlanCatalog";

/** Navigation context only. Selection does not grant a plan or start checkout. */
export interface PublicPlanSelection { planId: PaidPublicPlanId; billingInterval: BillingInterval }
export function parsePublicPlanSelection(query: { plan?: unknown; interval?: unknown }): PublicPlanSelection | null {
  return typeof query.plan === "string" && isPaidPublicPlanId(query.plan)
    && typeof query.interval === "string" && isBillingInterval(query.interval)
    ? { planId: query.plan, billingInterval: query.interval } : null;
}
export function publicPlanSelectionPath(selection: PublicPlanSelection): string {
  return `/control/plans?plan=${selection.planId}&interval=${selection.billingInterval}`;
}
export function publicPlanSignInPath(selection: PublicPlanSelection, ownedTestCheckout = false): string {
  const target = ownedTestCheckout ? `/plans?plan=${selection.planId}&interval=${selection.billingInterval}` : publicPlanSelectionPath(selection);
  return `/auth/signin?callbackUrl=${encodeURIComponent(target)}`;
}
