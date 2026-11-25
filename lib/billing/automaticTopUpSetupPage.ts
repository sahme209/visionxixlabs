export const automaticTopUpSetupPath = "/control/usage-billing/automatic-top-up";

export function automaticTopUpSetupPublishableKey(): string | null {
  if (process.env.AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED !== "true" || process.env.AXIOM_STRIPE_MODE !== "test") return null;
  const key = process.env.AXIOM_STRIPE_TEST_PUBLISHABLE_KEY?.trim() ?? "";
  return /^pk_test_[A-Za-z0-9_]+$/.test(key) ? key : null;
}
