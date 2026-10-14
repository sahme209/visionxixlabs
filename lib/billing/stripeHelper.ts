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
import {
  stripePriceEnvKey,
  type BillingInterval,
  type PaidPublicPlanId,
} from "./publicPlanCatalog";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export interface StripeStatus {
  configured: boolean;
  webhookConfigured: boolean;
  mode: "test" | "live" | "invalid";
  liveBillingApproved: boolean;
  pricedPlans: Partial<Record<PaidPublicPlanId, Partial<Record<BillingInterval, string>>>>;
  hint: string;
}

export function describeStripeStatus(): StripeStatus {
  const configured = isStripeConfigured();
  const webhookConfigured = isStripeWebhookConfigured();
  const mode = resolveStripeMode();
  const liveBillingApproved = process.env.AXIOM_LIVE_BILLING_APPROVED === "true";
  const pricedPlans: StripeStatus["pricedPlans"] = {};
  for (const planId of ["pro", "enterprise"] as PaidPublicPlanId[]) {
    for (const interval of ["monthly", "annual"] as BillingInterval[]) {
      const value = process.env[stripePriceEnvKey(planId, interval)]?.trim();
      if (value) {
        pricedPlans[planId] = { ...pricedPlans[planId], [interval]: value };
      }
    }
  }
  let hint = "";
  if (!configured) hint = "Set STRIPE_SECRET_KEY to enable checkout.";
  else if (!webhookConfigured) hint = "Set STRIPE_WEBHOOK_SECRET so webhook delivery can be signature-verified.";
  else if (mode === "invalid") hint = "Set AXIOM_STRIPE_MODE=test with an sk_test_ key before validating checkout.";
  else if (mode === "live" && !liveBillingApproved) hint = "Live billing is locked until AXIOM_LIVE_BILLING_APPROVED=true is explicitly set.";
  else if (Object.keys(pricedPlans).length === 0) hint = "Configure STRIPE_PRICE_PRO_MONTHLY and the other approved plan interval price ids.";
  else hint = "Stripe fully configured.";
  return { configured, webhookConfigured, mode, liveBillingApproved, pricedPlans, hint };
}

function resolveStripeMode(): StripeStatus["mode"] {
  const configuredMode = process.env.AXIOM_STRIPE_MODE?.trim().toLowerCase();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (configuredMode === "test" && key.startsWith("sk_test_")) return "test";
  if (configuredMode === "live" && key.startsWith("sk_live_")) return "live";
  return "invalid";
}

function checkoutModeFailure(): string | null {
  const mode = resolveStripeMode();
  if (mode === "invalid") return "Stripe mode and secret key do not match a declared test or live configuration.";
  if (mode === "live" && process.env.AXIOM_LIVE_BILLING_APPROVED !== "true") {
    return "Live billing has not been explicitly approved.";
  }
  return null;
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
  planId: PaidPublicPlanId;
  billingInterval: BillingInterval;
  seatCount: number;
  /** Where to send the customer after success. */
  successUrl: string;
  /** Where to send the customer after cancel. */
  cancelUrl: string;
}

export interface CreateAddOnCheckoutInput {
  purchaseId: string;
  organizationId: string;
  email: string;
  sku: string;
  displayName: string;
  priceCents: number;
  idempotencyKey: string;
  successUrl: string;
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
  const modeFailure = checkoutModeFailure();
  if (modeFailure) return { ok: false, reason: modeFailure };
  if (!Number.isSafeInteger(input.seatCount) || input.seatCount < 1) {
    return { ok: false, reason: "seatCount must be a positive integer." };
  }
  const priceEnvKey = stripePriceEnvKey(input.planId, input.billingInterval);
  const priceId = process.env[priceEnvKey]?.trim();
  if (!priceId) {
    return { ok: false, reason: `${priceEnvKey} is not set.` };
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
      line_items: [{ price: priceId, quantity: input.seatCount }],
      customer_email: input.email,
      client_reference_id: input.organizationId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        organizationId: input.organizationId,
        planId: input.planId,
        billingInterval: input.billingInterval,
        seatCount: String(input.seatCount),
      },
      subscription_data: {
        metadata: {
          organizationId: input.organizationId,
          planId: input.planId,
          billingInterval: input.billingInterval,
          seatCount: String(input.seatCount),
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

/**
 * Create a one-time AI-credit Checkout session. This path intentionally accepts
 * test credentials only; enabling recurring live billing must never silently
 * activate prepaid-credit sales.
 */
export async function createAddOnCheckoutSession(input: CreateAddOnCheckoutInput): Promise<CheckoutSessionResult & { sessionId?: string }> {
  if (resolveStripeMode() !== "test") {
    return { ok: false, reason: "AI credit checkout requires AXIOM_STRIPE_MODE=test with an sk_test_ key." };
  }
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 50) {
    return { ok: false, reason: "The add-on price is invalid." };
  }

  type StripeCheckoutCtor = new (key: string, opts?: unknown) => {
    checkout: {
      sessions: {
        create: (
          params: unknown,
          options?: { idempotencyKey?: string },
        ) => Promise<{ id: string; url?: string | null }>;
      };
    };
  };
  let StripeCtor: StripeCheckoutCtor;
  try {
    const mod = (await import("stripe")) as unknown as { default: StripeCheckoutCtor };
    StripeCtor = mod.default;
  } catch (err) {
    return { ok: false, reason: `Stripe SDK unavailable: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY!.trim(), { apiVersion: "2024-06-20" });
    const metadata = {
      purpose: "axiom_ai_credit_add_on",
      addOnPurchaseId: input.purchaseId,
      organizationId: input.organizationId,
      sku: input.sku,
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.priceCents,
          product_data: { name: input.displayName, metadata: { sku: input.sku } },
        },
      }],
      customer_email: input.email,
      client_reference_id: input.organizationId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    }, { idempotencyKey: input.idempotencyKey });
    if (!session.url) return { ok: false, reason: "Stripe did not return a checkout URL." };
    return { ok: true, url: session.url, sessionId: session.id };
  } catch (err) {
    return { ok: false, reason: `Stripe create failed: ${err instanceof Error ? err.message : String(err)}` };
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
  const modeFailure = checkoutModeFailure();
  if (modeFailure) return { ok: false, reason: modeFailure };
  if (!input.customerId) {
    return { ok: false, reason: "Stripe customer id missing — complete checkout first." };
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
