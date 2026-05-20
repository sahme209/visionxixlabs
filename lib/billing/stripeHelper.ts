/**
 * Stripe helper — checkout-session creator + webhook signature
 * verifier.
 *
 * Designed to be **gracefully inert** when STRIPE_SECRET_KEY is
 * unset. The platform must still boot + render its dashboards
 * without Stripe wired; only the checkout / portal surfaces light
 * up once env keys land.
 *
 * Hard rules:
 *   - No network call when STRIPE_SECRET_KEY is missing.
 *   - The Stripe SDK is loaded via dynamic import — `stripe` is not
 *     in package.json yet, so callers MUST check `isStripeConfigured()`
 *     before invoking the helpers. If the SDK can't load, helpers
 *     return a typed `{ ok: false, reason }` envelope instead of
 *     throwing.
 *   - Webhook signature verification uses HMAC-SHA256 against
 *     STRIPE_WEBHOOK_SECRET. Verifier returns `{ ok, reason }` —
 *     never throws. Caller decides the HTTP response.
 *   - This module never reads or writes Postgres; the caller takes
 *     the parsed event and feeds it into upsertBillingPlan.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingTier } from "./tierCatalog";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export interface StripeStatus {
  configured: boolean;
  webhookConfigured: boolean;
  /** Stripe Price ID for each tier when STRIPE_PRICE_<TIER> is set. */
  pricedTiers: Partial<Record<BillingTier, string>>;
  hint: string;
}

export function describeStripeStatus(): StripeStatus {
  const configured = isStripeConfigured();
  const webhookConfigured = isStripeWebhookConfigured();
  const pricedTiers: Partial<Record<BillingTier, string>> = {};
  for (const tier of ["starter", "growth", "enterprise"] as BillingTier[]) {
    const envKey = `STRIPE_PRICE_${tier.toUpperCase()}`;
    const v = process.env[envKey]?.trim();
    if (v) pricedTiers[tier] = v;
  }
  let hint = "";
  if (!configured) hint = "Set STRIPE_SECRET_KEY to enable checkout.";
  else if (!webhookConfigured) hint = "Set STRIPE_WEBHOOK_SECRET so webhook delivery can be signature-verified.";
  else if (Object.keys(pricedTiers).length === 0) hint = "Configure STRIPE_PRICE_STARTER / STRIPE_PRICE_GROWTH / STRIPE_PRICE_ENTERPRISE.";
  else hint = "Stripe fully configured.";
  return { configured, webhookConfigured, pricedTiers, hint };
}

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export interface CheckoutSessionResult {
  ok: boolean;
  /** Hosted checkout URL when ok = true. */
  url?: string;
  /** Why we didn't / couldn't create a session when ok = false. */
  reason?: string;
}

export interface CreateCheckoutInput {
  organizationId: string;
  email: string;
  tier: BillingTier;
  /** Where to send the customer after success. */
  successUrl: string;
  /** Where to send the customer after cancel. */
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session. Returns `{ ok: false, reason }`
 * when Stripe isn't configured or the SDK can't load — callers
 * surface the reason in the UI instead of crashing.
 */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return { ok: false, reason: "STRIPE_SECRET_KEY is not set." };
  }
  const priceId = process.env[`STRIPE_PRICE_${input.tier.toUpperCase()}`]?.trim();
  if (!priceId) {
    return { ok: false, reason: `STRIPE_PRICE_${input.tier.toUpperCase()} is not set.` };
  }

  type StripeCheckoutCtor = new (key: string, opts?: unknown) => {
    checkout: { sessions: { create: (params: unknown) => Promise<{ url?: string | null }> } };
  };
  let StripeCtor: StripeCheckoutCtor;
  try {
    const mod = (await import("stripe")) as unknown as { default: StripeCheckoutCtor };
    StripeCtor = mod.default;
  } catch (err) {
    return {
      ok: false,
      reason: `Stripe SDK not installed yet: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY!.trim(), { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: input.email,
      client_reference_id: input.organizationId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        organizationId: input.organizationId,
        tier: input.tier,
      },
      subscription_data: {
        metadata: {
          organizationId: input.organizationId,
          tier: input.tier,
        },
      },
    });
    if (!session.url) {
      return { ok: false, reason: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    return {
      ok: false,
      reason: `Stripe create failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Billing portal session (Phase 142)
// ---------------------------------------------------------------------------

export interface PortalSessionInput {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

/**
 * Create a Stripe Billing Portal session — the operator-facing
 * page where customers manage their card, cancel, change plans.
 * Gracefully inert when STRIPE_SECRET_KEY is unset, same pattern as
 * createCheckoutSession.
 */
export async function createBillingPortalSession(input: PortalSessionInput): Promise<PortalSessionResult> {
  if (!isStripeConfigured()) {
    return { ok: false, reason: "STRIPE_SECRET_KEY is not set." };
  }
  if (!input.customerId) {
    return { ok: false, reason: "Stripe customer id missing — operator must complete checkout first." };
  }

  type StripePortalCtor = new (key: string, opts?: unknown) => {
    billingPortal: { sessions: { create: (params: unknown) => Promise<{ url?: string | null }> } };
  };
  let StripeCtor: StripePortalCtor;
  try {
    const mod = (await import("stripe")) as unknown as { default: StripePortalCtor };
    StripeCtor = mod.default;
  } catch (err) {
    return {
      ok: false,
      reason: `Stripe SDK not installed yet: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY!.trim(), { apiVersion: "2024-06-20" });
    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    if (!session.url) {
      return { ok: false, reason: "Stripe did not return a portal URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    return {
      ok: false,
      reason: `Stripe portal create failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

export interface WebhookVerification {
  ok: boolean;
  reason?: string;
}

/**
 * Verify a Stripe webhook signature without the Stripe SDK. The
 * `stripe-signature` header is a comma-separated list of `k=v`
 * pairs: `t=<timestamp>,v1=<sig>`. We compute HMAC-SHA256 of
 * `<timestamp>.<rawBody>` keyed by STRIPE_WEBHOOK_SECRET and
 * compare with timingSafeEqual.
 */
export function verifyWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  /** Optional tolerance in seconds (Stripe defaults to 300). */
  toleranceSeconds?: number;
}): WebhookVerification {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return { ok: false, reason: "STRIPE_WEBHOOK_SECRET is not set." };
  if (!opts.signatureHeader) return { ok: false, reason: "Missing stripe-signature header." };

  const tolerance = opts.toleranceSeconds ?? 300;
  const parts = opts.signatureHeader.split(",").map((s) => s.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Parts = parts.filter((p) => p.startsWith("v1="));
  if (!tPart || v1Parts.length === 0) return { ok: false, reason: "Malformed stripe-signature header." };

  const timestamp = Number(tPart.slice(2));
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "Non-numeric timestamp in signature." };

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSec > tolerance) return { ok: false, reason: `Timestamp outside tolerance (${ageSec}s > ${tolerance}s).` };

  const signedPayload = `${timestamp}.${opts.rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const sigPart of v1Parts) {
    const provided = sigPart.slice(3);
    let providedBuf: Buffer;
    try {
      providedBuf = Buffer.from(provided, "hex");
    } catch {
      continue;
    }
    if (providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "No v1 signature matched." };
}
