import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Prisma } from "@/lib/prismaClient";
import { prisma } from "@/lib/db";
import { createBadgeToken } from "@/lib/supporters/core";
import { sendSupporterConfirmation } from "@/lib/supporters/email";

export const runtime = "nodejs";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  return new Stripe(key);
}

function paymentIntentId(value: string | Stripe.PaymentIntent | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

const supporterPurpose = "axiom_founding_supporter";

function checkoutPurchaseId(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.supporterPurchaseId;
  return session.id && purchaseId && session.metadata?.purpose === supporterPurpose
    && session.client_reference_id === purchaseId ? purchaseId : null;
}

async function recordPayment(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session, replay: boolean) {
  const purchaseId = checkoutPurchaseId(session);
  const intentId = paymentIntentId(session.payment_intent);
  if (!purchaseId || !intentId || session.payment_status !== "paid" || !session.currency || !session.amount_total) return null;

  const identity = { id: purchaseId, currency: session.currency, amountCents: { lte: session.amount_total } };
  if (!replay) {
    const now = new Date();
    await tx.foundingSupporterPurchase.updateMany({
      where: {
        ...identity,
        status: { in: ["pending", "failed", "expired"] },
        refundedAmountCents: 0,
        AND: [
          { OR: [{ stripeCheckoutSessionId: session.id }, { stripeCheckoutSessionId: null }] },
          { OR: [{ stripePaymentIntentId: intentId }, { stripePaymentIntentId: null }] },
        ],
      },
      data: {
        status: "paid",
        paidAt: now,
        badgeIssuedAt: now,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: intentId,
      },
    });
  }
  return tx.foundingSupporterPurchase.findFirst({
    where: {
      ...identity,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: intentId,
      status: "paid",
      refundedAmountCents: 0,
      confirmationEmailSentAt: null,
    },
  });
}

async function recordCheckoutFailure(tx: Prisma.TransactionClient, session: Stripe.Checkout.Session, expired: boolean) {
  const purchaseId = checkoutPurchaseId(session);
  if (!purchaseId) return;
  await tx.foundingSupporterPurchase.updateMany({
    where: {
      id: purchaseId,
      status: "pending",
      refundedAmountCents: 0,
      OR: [{ stripeCheckoutSessionId: session.id }, { stripeCheckoutSessionId: null }],
    },
    data: { status: expired ? "expired" : "failed", stripeCheckoutSessionId: session.id },
  });
}

async function recordRefund(tx: Prisma.TransactionClient, charge: Stripe.Charge) {
  const intentId = paymentIntentId(charge.payment_intent);
  if (!intentId || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded <= 0) return;
  const findByIntent = () => tx.foundingSupporterPurchase.findUnique({ where: { stripePaymentIntentId: intentId } });
  let purchase = await findByIntent();
  const purchaseId = charge.metadata?.supporterPurchaseId;
  if (!purchase && purchaseId && charge.metadata?.purpose === supporterPurpose) {
    // Roll back the event receipt when the refund arrives before Checkout
    // binds its PaymentIntent. Stripe can then retry the same event.
    const awaitingBinding = await tx.foundingSupporterPurchase.findFirst({
      where: { id: purchaseId, stripePaymentIntentId: null, currency: charge.currency },
      select: { id: true },
    });
    if (awaitingBinding) throw new Error("Supporter refund is awaiting PaymentIntent binding.");
    purchase = await findByIntent();
  }
  if (!purchase || charge.currency !== purchase.currency) return;

  const refundedAmountCents = Math.min(charge.amount_refunded, purchase.amountCents);
  const fullyRefunded = refundedAmountCents === purchase.amountCents;
  await tx.foundingSupporterPurchase.updateMany({
    where: {
      id: purchase.id,
      stripePaymentIntentId: intentId,
      status: { in: ["paid", "partially_refunded"] },
      refundedAmountCents: { lt: refundedAmountCents },
    },
    data: {
      refundedAmountCents,
      status: fullyRefunded ? "refunded" : "partially_refunded",
      refundedAt: fullyRefunded ? new Date() : null,
    },
  });
}

async function deliverConfirmation(
  purchase: {
    id: string;
    email: string;
    displayName: string | null;
    amountCents: number;
    confirmationEmailSentAt: Date | null;
  },
  origin: string,
) {
  if (purchase.confirmationEmailSentAt) return;
  const badgeSecret = process.env.SUPPORTER_BADGE_SIGNING_SECRET;
  if (!badgeSecret) throw new Error("Badge signing is not configured.");
  const token = createBadgeToken(purchase.id, badgeSecret);
  const sent = await sendSupporterConfirmation({
    email: purchase.email,
    displayName: purchase.displayName,
    amountCents: purchase.amountCents,
    referenceId: purchase.id,
    badgeUrl: `${origin}/api/support/badge/${purchase.id}?token=${encodeURIComponent(token)}`,
  });
  // A non-2xx response must cause Stripe to retry. The event ledger keeps the
  // financial mutation idempotent; the replay path retries only this delivery.
  if (!sent) throw new Error("Supporter confirmation email was not accepted for delivery.");
  await prisma.foundingSupporterPurchase.update({
    where: { id: purchase.id },
    data: { confirmationEmailSentAt: new Date() },
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Supporter webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supportedTypes = [
    "checkout.session.completed", "checkout.session.async_payment_succeeded",
    "checkout.session.expired", "checkout.session.async_payment_failed", "charge.refunded",
  ];
  if (!supportedTypes.includes(event.type)) return NextResponse.json({ received: true, ignored: true });

  try {
    const { replay, paidPurchase } = await prisma.$transaction(async (tx) => {
      const { count } = await tx.supporterStripeEvent.createMany({
        data: [{ id: event.id, type: event.type }],
        skipDuplicates: true,
      });
      const replay = count === 0;
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          return { replay, paidPurchase: await recordPayment(tx, event.data.object, replay) };
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed":
          if (!replay) await recordCheckoutFailure(tx, event.data.object, event.type === "checkout.session.expired");
          break;
        case "charge.refunded":
          if (!replay) await recordRefund(tx, event.data.object);
          break;
      }
      return { replay, paidPurchase: null };
    });

    if (paidPurchase) await deliverConfirmation(paidPurchase, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
    return NextResponse.json(replay ? { received: true, replay: true } : { received: true });
  } catch (error) {
    console.error("[Supporter webhook] Processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
