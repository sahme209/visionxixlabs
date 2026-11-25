import "server-only";

import type Stripe from "stripe";
import { automaticTopUpConsentDigest, matchesAutomaticTopUpProviderSetup, type AutomaticTopUpSetupBinding, type AutomaticTopUpSetupTerms } from "./automaticAICreditTopUpConsent";
import { PUBLIC_STRIPE_API_VERSION } from "./publicBillingConfig";
import type { PublicBillingIdentity } from "./publicCheckoutService";

type SetupClient = Pick<Stripe, "accounts" | "setupIntents">;

/** The caller supplies a strictly test-mode client. The transport has no
 * confirm, payment intent, or charge method and performs no automatic retry. */
export function makeAutomaticTopUpSetupProvider(client: SetupClient, identity: PublicBillingIdentity) {
  function responseVerified(response: Stripe.Response<unknown>["lastResponse"]) {
    return response.apiVersion === PUBLIC_STRIPE_API_VERSION && Boolean(response.requestId)
      && response.statusCode >= 200 && response.statusCode < 300
      && (!response.stripeAccount || response.stripeAccount === identity.accountId);
  }

  async function verifyAccount(terms: AutomaticTopUpSetupTerms) {
    if (identity.livemode !== false || terms.identity.livemode !== false || terms.identity.accountId !== identity.accountId) {
      throw new Error("auto_top_up_setup_account_invalid");
    }
    const account = await client.accounts.retrieve({}, { maxNetworkRetries: 0 });
    if (!responseVerified(account.lastResponse) || account.id !== identity.accountId) throw new Error("auto_top_up_setup_account_invalid");
  }

  function reviewResponse(terms: AutomaticTopUpSetupTerms, setup: Stripe.Response<Stripe.SetupIntent>) {
    if (!responseVerified(setup.lastResponse) || !matchesAutomaticTopUpProviderSetup(terms, setup)) {
      throw new Error("auto_top_up_setup_observation_invalid");
    }
    return { accountId: identity.accountId, setup };
  }

  return {
    async create(terms: AutomaticTopUpSetupTerms) {
      await verifyAccount(terms);
      return reviewResponse(terms, await client.setupIntents.create({
        customer: terms.customerId,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: { purpose: "axiom_auto_ai_credit_setup_v1", consent_digest: automaticTopUpConsentDigest(terms) },
      }, { idempotencyKey: `axiom_top_up_setup_${terms.attemptId}`, maxNetworkRetries: 0 }));
    },
    async retrieve(binding: AutomaticTopUpSetupBinding) {
      await verifyAccount(binding);
      const observed = reviewResponse(binding, await client.setupIntents.retrieve(
        binding.setupIntentId, { expand: ["payment_method"] }, { maxNetworkRetries: 0 },
      ));
      if (observed.setup.id !== binding.setupIntentId) throw new Error("auto_top_up_setup_observation_invalid");
      return observed;
    },
  };
}
