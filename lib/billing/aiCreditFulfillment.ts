import "server-only";

import { prisma } from "@/lib/db";
import { findAddOn } from "./addOnCatalog";

type CheckoutSession = {
  id?: string;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: {
    purpose?: string;
    addOnPurchaseId?: string;
    organizationId?: string;
    sku?: string;
  } | null;
};

type RefundCharge = {
  payment_intent?: string | { id?: string } | null;
  amount_refunded?: number | null;
  currency?: string | null;
};

export interface CreditStripeEvent {
  id: string;
  type: string;
}

function paymentIntentId(value: CheckoutSession["payment_intent"]): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function assertCheckout(session: CheckoutSession) {
  const metadata = session.metadata;
  const purchaseId = metadata?.addOnPurchaseId;
  const organizationId = metadata?.organizationId;
  const sku = metadata?.sku;
  const addOn = sku ? findAddOn(sku) : null;
  const intentId = paymentIntentId(session.payment_intent);
  if (
    metadata?.purpose !== "axiom_ai_credit_add_on"
    || !purchaseId
    || !organizationId
    || !addOn
    || addOn.category !== "ai_credits"
    || !session.id
    || !intentId
    || session.payment_status !== "paid"
    || session.currency?.toLowerCase() !== "usd"
    || session.amount_total !== addOn.priceCents
  ) {
    throw new Error("ai_credit_checkout_invalid");
  }
  return { purchaseId, organizationId, addOn, intentId, sessionId: session.id };
}

export async function fulfillAICreditCheckout(event: CreditStripeEvent, session: CheckoutSession) {
  const verified = assertCheckout(session);
  return prisma.$transaction(async (tx) => {
    await tx.stripeBillingEvent.create({ data: { id: event.id, type: event.type } });
    const purchase = await tx.addOnPurchase.findUnique({ where: { id: verified.purchaseId } });
    if (
      !purchase
      || purchase.organizationId !== verified.organizationId
      || purchase.sku !== verified.addOn.sku
      || purchase.pricePaidCents !== verified.addOn.priceCents
      || purchase.deliveredAICreditsCents !== verified.addOn.deliveredAICreditsCents
      || (purchase.stripeCheckoutSessionId && purchase.stripeCheckoutSessionId !== verified.sessionId)
      || !["pending", "paid"].includes(purchase.status)
    ) {
      throw new Error("ai_credit_purchase_mismatch");
    }
    return tx.addOnPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "paid",
        appliedAt: purchase.appliedAt ?? new Date(),
        stripeCheckoutSessionId: verified.sessionId,
        stripePaymentIntentId: verified.intentId,
      },
    });
  });
}

export async function recordAICreditCheckoutFailure(event: CreditStripeEvent, session: CheckoutSession) {
  return prisma.$transaction(async (tx) => {
    await tx.stripeBillingEvent.create({ data: { id: event.id, type: event.type } });
    if (session.metadata?.purpose !== "axiom_ai_credit_add_on" || !session.metadata.addOnPurchaseId) return null;
    return tx.addOnPurchase.updateMany({
      where: { id: session.metadata.addOnPurchaseId, status: "pending" },
      data: { status: event.type === "checkout.session.expired" ? "expired" : "failed" },
    });
  });
}

export async function reverseAICreditRefund(event: CreditStripeEvent, charge: RefundCharge) {
  const intentId = paymentIntentId(charge.payment_intent);
  const refunded = charge.amount_refunded;
  if (!intentId || !Number.isSafeInteger(refunded) || (refunded ?? 0) < 0 || charge.currency?.toLowerCase() !== "usd") {
    throw new Error("ai_credit_refund_invalid");
  }
  return prisma.$transaction(async (tx) => {
    await tx.stripeBillingEvent.create({ data: { id: event.id, type: event.type } });
    const purchase = await tx.addOnPurchase.findUnique({ where: { stripePaymentIntentId: intentId } });
    if (!purchase) return null;
    const refundedAmountCents = Math.min(refunded!, purchase.pricePaidCents);
    const reversedAICreditsCents = Math.min(
      purchase.deliveredAICreditsCents,
      Math.ceil((purchase.deliveredAICreditsCents * refundedAmountCents) / purchase.pricePaidCents),
    );
    const fullyRefunded = refundedAmountCents >= purchase.pricePaidCents;
    // Stripe retries and delivers events out of order. A lower cumulative
    // refund must never restore credits already revoked by a newer event.
    // Compare at write time as concurrent handlers can read the same row.
    return tx.addOnPurchase.updateMany({
      where: {
        id: purchase.id,
        refundedAmountCents: { lte: refundedAmountCents },
        reversedAICreditsCents: { lte: reversedAICreditsCents },
      },
      data: {
        refundedAmountCents,
        reversedAICreditsCents,
        status: fullyRefunded ? "refunded" : "partially_refunded",
        refundedAt: fullyRefunded ? new Date() : null,
      },
    });
  });
}
