/**
 * POST /api/billing/stripe-webhook
 *
 * Stripe webhook receiver. Verifies the signature against
 * STRIPE_WEBHOOK_SECRET, parses the event, then atomically records the event in StripeBillingEvent and updates
 * TenantBillingPlan. Distinct-event ordering is not inferred from event IDs.
 *
 * Hard rules:
 *   - Reads the raw body for signature verification — Next.js
 *     gives us req.text() unparsed.
 *   - Returns 200 on idempotent re-receive (never tells Stripe to
 *     retry on a duplicate event).
 *   - Returns 401 on signature failure (Stripe will retry the
 *     legitimate originals).
 *   - Returns 503 honestly when STRIPE_WEBHOOK_SECRET is unset.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature, isStripeWebhookConfigured } from "@/lib/billing/stripeHelper";
import { consumeSubscriptionEvent } from "@/lib/billing/consumeSubscriptionEvent";
import type { BillingStatus } from "@/lib/billing/tierCatalog";
import {
  isPaidPublicPlanId,
  isSelfServiceBillingEnabled,
  legacyEntitlementTierForPublicPlan,
} from "@/lib/billing/publicPlanCatalog";
import { resolveCorrelationId } from "@/lib/api";
import {
  fulfillAICreditCheckout,
  recordAICreditCheckoutFailure,
  reverseAICreditRefund,
} from "@/lib/billing/aiCreditFulfillment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StripeWebhookEvent {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      metadata?: {
        organizationId?: string;
        planId?: string;
        purpose?: string;
        addOnPurchaseId?: string;
        sku?: string;
      };
      payment_status?: string;
      payment_intent?: string | { id?: string } | null;
      amount_total?: number | null;
      amount_refunded?: number | null;
      currency?: string | null;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
      items?: { data?: Array<{ quantity?: number }> };
    };
  };
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);

  if (!isSelfServiceBillingEnabled()) {
    return NextResponse.json(
      { ok: false, error: { code: "billing.disabled", userMessage: "Self-service billing is not active." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.not_configured", userMessage: "STRIPE_WEBHOOK_SECRET is not set." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const verdict = verifyWebhookSignature({ rawBody, signatureHeader: signature });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.signature_invalid", userMessage: verdict.reason }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 401 },
    );
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.body_invalid", userMessage: "Webhook body is not valid JSON." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 400 },
    );
  }

  const obj = event.data?.object;

  if (event.id && obj && isAICreditCheckoutEvent(event.type, obj.metadata?.purpose)) {
    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        await fulfillAICreditCheckout({ id: event.id, type: event.type! }, obj);
      } else {
        await recordAICreditCheckoutFailure({ id: event.id, type: event.type! }, obj);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      if (isReplay(error)) return NextResponse.json({ ok: true, replay: true }, { status: 200 });
      const invalid = error instanceof Error && error.message.startsWith("ai_credit_");
      return NextResponse.json(
        { ok: false, error: { code: invalid ? error.message : "billing.write_failed", userMessage: invalid ? "The signed credit event did not match its purchase." : "Credit fulfillment failed." } },
        { status: invalid ? 400 : 500 },
      );
    }
  }

  if (event.id && event.type === "charge.refunded" && obj) {
    try {
      await reverseAICreditRefund({ id: event.id, type: event.type! }, obj);
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      if (isReplay(error)) return NextResponse.json({ ok: true, replay: true }, { status: 200 });
      const invalid = error instanceof Error && error.message === "ai_credit_refund_invalid";
      return NextResponse.json({ ok: false, error: { code: invalid ? "ai_credit_refund_invalid" : "billing.write_failed" } }, { status: invalid ? 400 : 500 });
    }
  }

  const organizationId = obj?.metadata?.organizationId;
  const planId = obj?.metadata?.planId;

  if (!organizationId || !planId || !isPaidPublicPlanId(planId)) {
    // We accept the event but can't act on it without metadata.
    return NextResponse.json({ ok: true, ignored: "missing_metadata" }, { status: 200 });
  }

  if (!isSubscriptionEvent(event.type)) {
    // Checkout completion is not entitlement authority. Stripe's signed
    // subscription lifecycle event carries the authoritative status.
    return NextResponse.json({ ok: true, ignored: "awaiting_subscription_event" }, { status: 200 });
  }

  if (!event.id || !obj?.id || !obj.customer) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "stripe.event_incomplete",
          userMessage: "The signed subscription event is missing its event, subscription, or customer identifier.",
        },
        meta: { correlationId, generatedAt: new Date().toISOString() },
      },
      { status: 400 },
    );
  }

  const tier = legacyEntitlementTierForPublicPlan(planId);
  const status: BillingStatus = event.type === "customer.subscription.deleted"
    ? "canceled"
    : mapStripeStatus(obj?.status);
  const currentPeriodEndsAt = obj?.current_period_end
    ? new Date(obj.current_period_end * 1000)
    : null;
  const seatQuantity = obj?.items?.data?.reduce(
    (sum, item) => sum + (Number.isSafeInteger(item.quantity) && (item.quantity ?? 0) > 0 ? item.quantity! : 0),
    0,
  ) ?? 0;
  if (event.type !== "customer.subscription.deleted" && seatQuantity < 1) {
    return NextResponse.json(
      { ok: false, error: { code: "stripe.seat_quantity_invalid", userMessage: "The subscription has no valid paid seat quantity." }, meta: { correlationId, generatedAt: new Date().toISOString() } },
      { status: 400 },
    );
  }

  try {
    const outcome = await consumeSubscriptionEvent(event.type!, {
      organizationId,
      tier,
      status,
      trialEndsAt: null,
      currentPeriodEndsAt,
      stripeCustomerId: obj.customer,
      stripeSubscriptionId: obj.id,
      cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
      lastStripeEventId: event.id,
      seatQuantity: seatQuantity > 0 ? seatQuantity : null,
    });
    if (outcome === "replay") return NextResponse.json({ ok: true, replay: true }, { status: 200 });
    if (outcome === "ownership_conflict") {
      return NextResponse.json({ ok: false, error: { code: "stripe.ownership_conflict", userMessage: "This Stripe customer or subscription is already assigned to another workspace." }, meta: { correlationId, generatedAt: new Date().toISOString() } }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "billing.verification_unavailable",
          userMessage: "Subscription verification or storage could not be confirmed. Please retry this event.",
        },
        meta: { correlationId, generatedAt: new Date().toISOString() },
      },
      { status: 503 },
    );
  }
}

function isSubscriptionEvent(type: string | undefined): boolean {
  return type === "customer.subscription.created"
    || type === "customer.subscription.updated"
    || type === "customer.subscription.deleted";
}

function isAICreditCheckoutEvent(type: string | undefined, purpose: string | undefined): boolean {
  return purpose === "axiom_ai_credit_add_on" && (
    type === "checkout.session.completed"
    || type === "checkout.session.async_payment_succeeded"
    || type === "checkout.session.expired"
    || type === "checkout.session.async_payment_failed"
  );
}

function isReplay(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2002";
}

function mapStripeStatus(s: string | undefined): BillingStatus {
  switch ((s ?? "").toLowerCase()) {
    case "trialing":         return "trialing";
    case "active":           return "active";
    case "past_due":
    case "unpaid":           return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default:                 return "no_plan";
  }
}
