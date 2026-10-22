import "server-only";
import type { PublicBillingIdentity } from "./publicCheckoutService";
export const PUBLIC_BILLING_POLICY = "axiom_public_anniversary_v1" as const;
export const PUBLIC_STRIPE_API_VERSION = "2024-06-20" as const;
/** Authority remains enabled when new sales are paused. Never use the checkout
 * switch to remove an already-enrolled customer's accounting enforcement. */
export function publicBillingPolicyEnabled(): boolean {
  return process.env.AXIOM_PUBLIC_BILLING_POLICY === PUBLIC_BILLING_POLICY;
}
export function configuredPublicBillingIdentity(): PublicBillingIdentity {
  if (!publicBillingPolicyEnabled()) throw Error("public_billing_not_activated");
  const accountId = process.env.AXIOM_STRIPE_ACCOUNT_ID?.trim(), mode = process.env.AXIOM_STRIPE_MODE;
  if (!accountId || !/^acct_[A-Za-z0-9_]+$/.test(accountId) || !["test","live"].includes(mode ?? "")) throw Error("public_billing_identity_unavailable");
  if (mode === "live" && process.env.AXIOM_LIVE_BILLING_APPROVED !== "true") throw Error("public_live_billing_not_approved");
  return { accountId, livemode: mode === "live" };
}
