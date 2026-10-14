import { afterEach, describe, expect, it } from "vitest";
import { createBadgeToken, normalizeCheckoutInput, supporterCheckoutReadiness, verifyBadgeToken } from "../core";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("supporter input", () => {
  it("accepts a valid one-time supporter purchase", () => {
    expect(normalizeCheckoutInput({
      amountCents: 10_000,
      email: "SUPPORTER@example.com",
      recognitionConsent: false,
      updatesOptIn: true,
      acceptedTerms: true,
    }).email).toBe("supporter@example.com");
  });

  it.each([99, 100_000_000, 10.5])("rejects unsupported amounts: %s", (amountCents) => {
    expect(() => normalizeCheckoutInput({ amountCents, email: "a@b.com", acceptedTerms: true })).toThrow();
  });

  it("requires a public name only when recognition is requested", () => {
    expect(() => normalizeCheckoutInput({
      amountCents: 100,
      email: "a@b.com",
      recognitionConsent: true,
      acceptedTerms: true,
    })).toThrow(/recognition name/);
  });
});

describe("supporter safety gates", () => {
  it("fails closed for live keys without explicit live approval", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET = "whsec_supporter";
    process.env.SUPPORTER_BADGE_SIGNING_SECRET = "long-secret";
    process.env.AXIOM_SUPPORTER_CHECKOUT_ENABLED = "true";
    delete process.env.AXIOM_SUPPORTER_LIVE_APPROVED;
    expect(supporterCheckoutReadiness().ready).toBe(false);
  });

  it.each(["rk_live_example", "unknown_secret_format"])('fails closed for non-test key format %s', (key) => {
    process.env.STRIPE_SECRET_KEY = key;
    process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET = "whsec_supporter";
    process.env.SUPPORTER_BADGE_SIGNING_SECRET = "long-secret";
    process.env.DATABASE_URL = "postgresql://test.invalid/test";
    process.env.RESEND_API_KEY = "re_test";
    process.env.AXIOM_SUPPORTER_CHECKOUT_ENABLED = "true";
    delete process.env.AXIOM_SUPPORTER_LIVE_APPROVED;
    expect(supporterCheckoutReadiness().ready).toBe(false);
  });

  it("allows a fully configured test-mode review flow", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET = "whsec_supporter";
    process.env.SUPPORTER_BADGE_SIGNING_SECRET = "long-secret";
    process.env.DATABASE_URL = "postgresql://test.invalid/test";
    process.env.RESEND_API_KEY = "re_test";
    process.env.AXIOM_SUPPORTER_CHECKOUT_ENABLED = "true";
    expect(supporterCheckoutReadiness().ready).toBe(true);
  });
});

describe("digital badge tokens", () => {
  it("authenticates the purchase without exposing a stored token", () => {
    const token = createBadgeToken("purchase_1", "badge-secret");
    expect(verifyBadgeToken("purchase_1", token, "badge-secret")).toBe(true);
    expect(verifyBadgeToken("purchase_2", token, "badge-secret")).toBe(false);
  });
});
