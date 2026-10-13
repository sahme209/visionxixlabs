import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
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

async function markPaid(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.metadata?.purpose !== "axiom_founding_supporter" || session.payment_status !== "paid") return null;
  const purchaseId = session.metadata.supporterPurchaseId;
  if (!purchaseId) return null;
  return prisma.$transaction(async (tx) => {
    await tx.supporterStripeEvent.create({ data: { id: event.id, type: event.type } });
    return tx.foundingSupporterPurchase.update({
      where: { id: purchaseId },
      data: {
        status: "paid",
        paidAt: new Date(),
        badgeIssuedAt: new Date(),
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId(session.payment_intent),
      },
    });
  });
}

async function recordNonPaymentEvent(event: Stripe.Event) {
  return prisma.$transaction(async (tx) => {
    await tx.supporterStripeEvent.create({ data: { id: event.id, type: event.type } });
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose === "axiom_founding_supporter" && session.metadata.supporterPurchaseId) {
        await tx.foundingSupporterPurchase.update({
          where: { id: session.metadata.supporterPurchaseId },
          data: { status: event.type === "checkout.session.expired" ? "expired" : "failed" },
        });
      }
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intentId = paymentIntentId(charge.payment_intent);
      if (intentId) {
        // The separate supporter ledger is the authority here. Looking up the
        // PaymentIntent avoids depending on Charge metadata propagation.
        const purchase = await tx.foundingSupporterPurchase.findUnique({ where: { stripePaymentIntentId: intentId } });
        if (purchase) {
          const fullyRefunded = charge.amount_refunded >= purchase.amountCents;
          await tx.foundingSupporterPurchase.update({
            where: { id: purchase.id },
            data: {
              refundedAmountCents: Math.min(charge.amount_refunded, purchase.amountCents),
              status: fullyRefunded ? "refunded" : "partially_refunded",
              refundedAt: fullyRefunded ? new Date() : null,
            },
          });
        }
      }
    }
  });
}

function isReplay(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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

  try {
    let paidPurchase = null;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      paidPurchase = await markPaid(event, event.data.object as Stripe.Checkout.Session);
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed", "charge.refunded"].includes(event.type)) {
      await recordNonPaymentEvent(event);
    } else {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (paidPurchase && !paidPurchase.confirmationEmailSentAt) {
      const badgeSecret = process.env.SUPPORTER_BADGE_SIGNING_SECRET;
      if (!badgeSecret) throw new Error("Badge signing is not configured.");
      const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const token = createBadgeToken(paidPurchase.id, badgeSecret);
      const sent = await sendSupporterConfirmation({
        email: paidPurchase.email,
        displayName: paidPurchase.displayName,
        amountCents: paidPurchase.amountCents,
        referenceId: paidPurchase.id,
        badgeUrl: `${origin}/api/support/badge/${paidPurchase.id}?token=${encodeURIComponent(token)}`,
      });
      if (sent) await prisma.foundingSupporterPurchase.update({ where: { id: paidPurchase.id }, data: { confirmationEmailSentAt: new Date() } });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isReplay(error)) return NextResponse.json({ received: true, replay: true });
    console.error("[Supporter webhook] Processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
