/**
 * Vitest unit tests for the Stripe webhook signature verifier.
 *
 * Locks in: HMAC-SHA256 over `{timestamp}.{rawBody}`, malformed
 * header rejection, tolerance window, secret-missing honesty.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  describeStripeStatus,
  createBillingPortalSession,
  createCheckoutSession,
  isStripeConfigured,
  isStripeWebhookConfigured,
  verifyWebhookSignature,
} from "../stripeHelper";

const ORIGINAL_SECRET = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET;
const ORIGINAL_MODE = process.env.AXIOM_STRIPE_MODE;
const ORIGINAL_LIVE_APPROVAL = process.env.AXIOM_LIVE_BILLING_APPROVED;
const ORIGINAL_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY;

const TEST_WEBHOOK_SECRET = "whsec_test_aaaaaaaa";

function buildSignedHeader(rawBody: string, timestamp: number, secret = TEST_WEBHOOK_SECRET): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const sig = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("Stripe env detection", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.AXIOM_STRIPE_MODE;
    delete process.env.AXIOM_LIVE_BILLING_APPROVED;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET;
    if (ORIGINAL_WEBHOOK === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK;
    if (ORIGINAL_MODE === undefined) delete process.env.AXIOM_STRIPE_MODE;
    else process.env.AXIOM_STRIPE_MODE = ORIGINAL_MODE;
    if (ORIGINAL_LIVE_APPROVAL === undefined) delete process.env.AXIOM_LIVE_BILLING_APPROVED;
    else process.env.AXIOM_LIVE_BILLING_APPROVED = ORIGINAL_LIVE_APPROVAL;
    if (ORIGINAL_PRO_MONTHLY === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    else process.env.STRIPE_PRICE_PRO_MONTHLY = ORIGINAL_PRO_MONTHLY;
  });

  it("isStripeConfigured returns false without secret key", () => {
    expect(isStripeConfigured()).toBe(false);
  });

  it("isStripeWebhookConfigured returns false without webhook secret", () => {
    expect(isStripeWebhookConfigured()).toBe(false);
  });

  it("describeStripeStatus returns honest hint when nothing wired", () => {
    const status = describeStripeStatus();
    expect(status.configured).toBe(false);
    expect(status.webhookConfigured).toBe(false);
    expect(status.hint).toMatch(/STRIPE_SECRET_KEY/);
  });

  it("describeStripeStatus surfaces test-mode public plan prices", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_xxx";
    process.env.AXIOM_STRIPE_MODE = "test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_xxx";
    const status = describeStripeStatus();
    expect(status.configured).toBe(true);
    expect(status.webhookConfigured).toBe(true);
    expect(status.mode).toBe("test");
    expect(status.pricedPlans.pro?.monthly).toBe("price_pro_monthly_xxx");
  });

  it("fails closed when a live key has not been explicitly approved", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_xxx";
    process.env.AXIOM_STRIPE_MODE = "live";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_live_xxx";
    const result = await createCheckoutSession({
      organizationId: "org_1",
      email: "owner@example.com",
      planId: "pro",
      billingInterval: "monthly",
      seatCount: 2,
      successUrl: "https://example.com/account?billing=success",
      cancelUrl: "https://example.com/plans?checkout=canceled",
    });
    expect(result).toEqual({ ok: false, reason: "Live billing has not been explicitly approved." });
  });

  it("keeps the billing portal behind the same live-mode approval lock", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_xxx";
    process.env.AXIOM_STRIPE_MODE = "live";
    const result = await createBillingPortalSession({
      customerId: "cus_1",
      returnUrl: "https://example.com/account?billing=return",
    });
    expect(result).toEqual({ ok: false, reason: "Live billing has not been explicitly approved." });
  });
});

describe("Stripe webhook verifier", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });
  afterEach(() => {
    if (ORIGINAL_WEBHOOK === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK;
  });

  it("accepts a valid signature within tolerance", () => {
    const body = JSON.stringify({ id: "evt_x", type: "test" });
    const ts = Math.floor(Date.now() / 1000);
    const header = buildSignedHeader(body, ts);
    expect(verifyWebhookSignature({ rawBody: body, signatureHeader: header }).ok).toBe(true);
  });

  it("rejects when secret is unset", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const body = "{}";
    const header = buildSignedHeader(body, Math.floor(Date.now() / 1000));
    const v = verifyWebhookSignature({ rawBody: body, signatureHeader: header });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it("rejects missing header", () => {
    const v = verifyWebhookSignature({ rawBody: "{}", signatureHeader: null });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/Missing/);
  });

  it("rejects malformed header", () => {
    const v = verifyWebhookSignature({ rawBody: "{}", signatureHeader: "not-a-real-stripe-sig" });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/Malformed/);
  });

  it("rejects expired timestamps (outside tolerance)", () => {
    const body = "{}";
    const oldTs = Math.floor(Date.now() / 1000) - 600;
    const header = buildSignedHeader(body, oldTs);
    const v = verifyWebhookSignature({ rawBody: body, signatureHeader: header, toleranceSeconds: 300 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/outside tolerance/);
  });

  it("rejects bad signatures", () => {
    const body = "{}";
    const ts = Math.floor(Date.now() / 1000);
    const wrongHeader = `t=${ts},v1=ff${Array(64).fill("0").join("")}`;
    const v = verifyWebhookSignature({ rawBody: body, signatureHeader: wrongHeader });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/No v1 signature matched/);
  });

  it("rejects mutated body even with valid-for-original signature", () => {
    const body = JSON.stringify({ id: "evt_x", type: "test" });
    const ts = Math.floor(Date.now() / 1000);
    const header = buildSignedHeader(body, ts);
    const tampered = body.replace('"test"', '"tampered"');
    const v = verifyWebhookSignature({ rawBody: tampered, signatureHeader: header });
    expect(v.ok).toBe(false);
  });
});
