import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { findAddOn } from "./addOnCatalog";
import type { PublicBillingIdentity } from "./publicCheckoutService";

/** The server's stored terms for one explicit workspace authorization.
 * These fields must come from the authenticated setup attempt, never a redirect
 * or webhook body. Setup success by itself conveys no commercial consent. */
export type AutomaticTopUpSetupBinding = Readonly<{
  attemptId: string;
  setupIntentId: string;
  organizationId: string;
  actorUserId: string;
  customerId: string;
  expectedRevision: number | null;
  identity: PublicBillingIdentity;
  thresholdCents: number;
  sku: string;
  amountCents: number;
  monthlyCeilingCents: number;
}>;

const cents = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;

export type AutomaticTopUpSetupTerms = Omit<AutomaticTopUpSetupBinding, "setupIntentId">;

export function automaticTopUpConsentDigest(binding: AutomaticTopUpSetupTerms): string {
  return createHash("sha256").update(JSON.stringify([
    "automatic-ai-credit-top-up:v1", binding.attemptId, binding.organizationId, binding.actorUserId,
    binding.customerId, binding.identity.accountId, binding.identity.livemode, binding.expectedRevision,
    binding.thresholdCents, binding.sku, binding.amountCents, binding.monthlyCeilingCents, "usd",
  ])).digest("hex");
}

export function matchesAutomaticTopUpProviderSetup(terms: AutomaticTopUpSetupTerms, setup: Stripe.SetupIntent) {
  const customerId = typeof setup.customer === "string" ? setup.customer : setup.customer?.id;
  return setup.object === "setup_intent" && /^seti_[A-Za-z0-9]+$/.test(setup.id) && setup.livemode === false
    && setup.usage === "off_session" && customerId === terms.customerId
    && setup.metadata?.purpose === "axiom_auto_ai_credit_setup_v1"
    && setup.metadata?.consent_digest === automaticTopUpConsentDigest(terms);
}

/** A server-side retrieve under the intended Stripe account must expand
 * payment_method. Its account context is supplied by the server transport.
 * This returns a stripped receipt with no client secret or card details. */
export function verifyAutomaticTopUpSetup(
  binding: AutomaticTopUpSetupBinding,
  observation: { accountId: string; setup: Stripe.SetupIntent },
) {
  const { identity } = binding;
  const pack = findAddOn(binding.sku);
  if (identity.livemode !== false || observation.accountId !== identity.accountId
      || !/^acct_[A-Za-z0-9]+$/.test(identity.accountId)
      || !/^cus_[A-Za-z0-9]+$/.test(binding.customerId)
      || !/^seti_[A-Za-z0-9]+$/.test(binding.setupIntentId)
      || !binding.attemptId || !binding.organizationId || !binding.actorUserId
      || (binding.expectedRevision !== null && (!cents(binding.expectedRevision) || binding.expectedRevision === 0))
      || !cents(binding.thresholdCents) || !cents(binding.amountCents) || !cents(binding.monthlyCeilingCents)
      || pack?.category !== "ai_credits" || pack.priceCents !== binding.amountCents
      || binding.monthlyCeilingCents < binding.amountCents) return null;

  const setup = observation.setup;
  if (!matchesAutomaticTopUpProviderSetup(binding, setup) || setup.id !== binding.setupIntentId
      || setup.status !== "succeeded") return null;
  const customerId = binding.customerId;

  const method = setup.payment_method;
  if (!method || typeof method === "string" || method.object !== "payment_method"
      || method.type !== "card" || method.livemode !== false || !/^pm_[A-Za-z0-9]+$/.test(method.id)) return null;
  const methodCustomer = typeof method.customer === "string" ? method.customer : method.customer?.id;
  if (methodCustomer !== customerId) return null;

  return {
    setupIntentId: setup.id, paymentMethodId: method.id, customerId,
    consentDigest: automaticTopUpConsentDigest(binding),
  };
}
