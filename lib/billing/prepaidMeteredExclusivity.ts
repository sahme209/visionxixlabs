import { publicBillingPolicyEnabled } from "./publicBillingConfig";
import { isSelfServiceBillingEnabled } from "./publicPlanCatalog";

/**
 * "Never beyond prepaid" (user decision 2026-11-08).
 *
 * Prepaid AI credits and metered post-use settlement
 * (`settleAIUsageToStripe.ts`) must never be enabled together: metered
 * settlement invoices usage after it happens, which could charge a customer
 * more than they prepaid. This module reads the EXISTING flags only; it adds
 * no flag and changes no default.
 *
 * Prepaid credit checkout is considered enabled when either existing gate
 * that can open it is on: `AXIOM_SELF_SERVICE_BILLING_ENABLED=true` or the
 * public billing policy (`AXIOM_PUBLIC_BILLING_POLICY`).
 */
export function prepaidAICreditsEnabled(): boolean {
  return isSelfServiceBillingEnabled() || publicBillingPolicyEnabled();
}

export const METERED_WITH_PREPAID_REASON =
  "Metered AI usage settlement is disabled while prepaid AI credits are enabled: Axiom never charges beyond prepaid.";

/** Returns a refusal reason when metered settlement must stay off, else null. */
export function meteredSettlementExclusivityFailure(): string | null {
  return prepaidAICreditsEnabled() ? METERED_WITH_PREPAID_REASON : null;
}
