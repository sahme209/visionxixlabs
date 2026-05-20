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
  isStripeConfigured,
  isStripeWebhookConfigured,
  verifyWebhookSignature,
} from "../stripeHelper";

const ORIGINAL_SECRET = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET;
const ORIGINAL_STARTER = process.env.STRIPE_PRICE_STARTER;

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
    delete process.env.STRIPE_PRICE_STARTER;
  });
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET;
    if (ORIGINAL_WEBHOOK === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK;
    if (ORIGINAL_STARTER === undefined) delete process.env.STRIPE_PRICE_STARTER;
    else process.env.STRIPE_PRICE_STARTER = ORIGINAL_STARTER;
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

  it("describeStripeStatus surfaces priced tiers when env keys present", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_xxx";
    process.env.STRIPE_PRICE_STARTER = "price_starter_xxx";
    const status = describeStripeStatus();
    expect(status.configured).toBe(true);
    expect(status.webhookConfigured).toBe(true);
    expect(status.pricedTiers.starter).toBe("price_starter_xxx");
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
