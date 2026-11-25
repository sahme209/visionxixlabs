import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { automaticTopUpSetupRuntime } from "../automaticAICreditTopUpSetupRuntime";
import { PUBLIC_BILLING_POLICY, PUBLIC_STRIPE_API_VERSION } from "../publicBillingConfig";

const mock = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("stripe", () => ({
  default: class StripeFixture {
    constructor(key: string, options: unknown) { mock.construct(key, options); }
  },
}));

describe("automatic top-up setup runtime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED", "true");
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", undefined);
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY", PUBLIC_BILLING_POLICY);
    vi.stubEnv("AXIOM_STRIPE_ACCOUNT_ID", "acct_fixture");
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable without the explicit test switch or in isolated IO-denied runtime", () => {
    vi.stubEnv("AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED", "");
    expect(automaticTopUpSetupRuntime()).toBeNull();
    vi.stubEnv("AXIOM_AUTO_TOP_UP_SETUP_TEST_ENABLED", "true");
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true");
    expect(automaticTopUpSetupRuntime()).toBeNull();
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it("rejects live mode and keys, retaining local operations when the provider is unavailable", () => {
    vi.stubEnv("AXIOM_STRIPE_MODE", "live");
    vi.stubEnv("AXIOM_LIVE_BILLING_APPROVED", "true");
    expect(automaticTopUpSetupRuntime()).toBeNull();
    vi.stubEnv("AXIOM_STRIPE_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture");
    const setup = automaticTopUpSetupRuntime();
    expect(setup?.providerConfigured).toBe(false);
    expect(() => setup?.service()).toThrow("automatic_top_up_test_key_unavailable");
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it("initializes only when setup transport is invoked, with finite timeout and no retries", () => {
    const setup = automaticTopUpSetupRuntime();
    expect(setup?.providerConfigured).toBe(true);
    expect(mock.construct).not.toHaveBeenCalled();
    expect(setup?.service()).toBeDefined();
    expect(mock.construct).toHaveBeenCalledExactlyOnceWith("sk_test_fixture", {
      apiVersion: PUBLIC_STRIPE_API_VERSION, maxNetworkRetries: 0, timeout: 10_000,
    });
  });
});
