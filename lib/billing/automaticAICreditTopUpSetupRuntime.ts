import "server-only";

import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { configuredPublicBillingIdentity, PUBLIC_STRIPE_API_VERSION } from "./publicBillingConfig";
import { isolatedRuntimeRequested } from "./isolatedApplication/runtime";
import { makeAutomaticTopUpSetupProvider } from "./automaticAICreditTopUpSetupProvider";
import { makeAutomaticTopUpSetupService } from "./automaticAICreditTopUpSetupService";
import { makeAutomaticTopUpTestRecovery } from "./automaticAICreditTopUpDispatchService";

/** Setup rehearsal is separately enabled. No live key, mode or fallback. */
export function automaticTopUpSetupRuntime() {
  if (process.env.AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED !== "true" || isolatedRuntimeRequested()) return null;
  const identity = configuredPublicBillingIdentity();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (identity.livemode) return null;
  const providerConfigured = /^(sk|rk)_test_[A-Za-z0-9_]+$/.test(key);
  function testClient() {
    if (!providerConfigured) throw new Error("automatic_top_up_test_key_unavailable");
    return new Stripe(key, {
      apiVersion: PUBLIC_STRIPE_API_VERSION as Stripe.LatestApiVersion, maxNetworkRetries: 0, timeout: 10_000,
    });
  }
  return {
    identity,
    providerConfigured,
    service() {
      return makeAutomaticTopUpSetupService(prisma, makeAutomaticTopUpSetupProvider(testClient(), identity));
    },
    recovery: () => makeAutomaticTopUpTestRecovery(prisma, testClient(), identity),
  };
}
