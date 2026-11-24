import "server-only";

import { prisma } from "@/lib/db";
import { findAddOn } from "./addOnCatalog";

type CreditPurchaseMetadata = {
  purpose?: string;
  addOnPurchaseId?: string;
  organizationId?: string;
  sku?: string;
};

type CheckoutSession = {
  id?: string;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: CreditPurchaseMetadata | null;
};

type RefundCharge = {
  payment_intent?: string | { id?: string } | null;
  amount_refunded?: number | null;
  metadata?: CreditPurchaseMetadata | null;
  currency?: string | null;
};

export interface CreditStripeEvent {
  id: string;
  type: string;
}

function paymentIntentId(value: CheckoutSession["payment_intent"]): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function assertCheckoutBinding(session: CheckoutSession) {
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
    || session.currency?.toLowerCase() !== "usd"
    || session.amount_total !== addOn.priceCents
  ) {
    throw new Error("ai_credit_checkout_invalid");
  }
  return { purchaseId, organizationId, addOn, intentId, sessionId: session.id };
}

function paidPurchaseStatus(refundedCents: number, priceCents: number) {
  if (refundedCents >= priceCents) return "refunded";
  return refundedCents > 0 ? "partially_refunded" : "paid";
}

export async function fulfillAICreditCheckout(event: CreditStripeEvent, session: CheckoutSession) {
  const verified = assertCheckoutBinding(session);
  if (!verified.intentId || session.payment_status !== "paid") throw new Error("ai_credit_checkout_invalid");
  const intentId = verified.intentId;
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
      || (purchase.stripePaymentIntentId && purchase.stripePaymentIntentId !== intentId)
      || !["pending", "paid", "partially_refunded", "refunded"].includes(purchase.status)
    ) {
      throw new Error("ai_credit_purchase_mismatch");
    }
    return tx.addOnPurchase.update({
      where: { id: purchase.id },
      data: {
        status: paidPurchaseStatus(purchase.refundedAmountCents, purchase.pricePaidCents),
        appliedAt: purchase.appliedAt ?? new Date(),
        stripeCheckoutSessionId: verified.sessionId,
        stripePaymentIntentId: intentId,
      },
    });
  }, { isolationLevel: "Serializable" });
}

export async function recordAICreditCheckoutFailure(event: CreditStripeEvent, session: CheckoutSession) {
  const { purchaseId, organizationId, addOn, intentId, sessionId } = assertCheckoutBinding(session);
  if (session.payment_status !== "unpaid") throw new Error("ai_credit_checkout_invalid");
  return prisma.$transaction(async (tx) => {
    await tx.stripeBillingEvent.create({ data: { id: event.id, type: event.type } });
    return tx.addOnPurchase.updateMany({
      where: {
        id: purchaseId,
        organizationId,
        sku: addOn.sku,
        pricePaidCents: addOn.priceCents,
        status: "pending",
        appliedAt: null,
        AND: [
          { OR: [{ stripeCheckoutSessionId: sessionId }, { stripeCheckoutSessionId: null }] },
          { OR: [{ stripePaymentIntentId: intentId }, { stripePaymentIntentId: null }] },
        ],
      },
      data: {
        status: event.type === "checkout.session.expired" ? "expired" : "failed",
        stripeCheckoutSessionId: sessionId,
      },
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
    const metadata = charge.metadata;
    const creditCharge = metadata?.purpose === "axiom_ai_credit_add_on";
    // Stripe copies PaymentIntent metadata to the Charge. That lets a signed
    // refund bind the original pending purchase before checkout fulfillment.
    const purchase = creditCharge
      ? metadata.addOnPurchaseId && await tx.addOnPurchase.findUnique({ where: { id: metadata.addOnPurchaseId } })
      : await tx.addOnPurchase.findUnique({ where: { stripePaymentIntentId: intentId } });
    if (creditCharge && (
      !purchase
      || metadata.organizationId !== purchase.organizationId
      || metadata.sku !== purchase.sku
      || (purchase.stripePaymentIntentId && purchase.stripePaymentIntentId !== intentId)
      || !["pending", "paid", "partially_refunded", "refunded"].includes(purchase.status)
    )) {
      throw new Error("ai_credit_refund_invalid");
    }
    if (!purchase || !["pending", "paid", "partially_refunded", "refunded"].includes(purchase.status)) return null;
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
        stripePaymentIntentId: intentId,
        status: purchase.status === "pending"
          ? "pending"
          : paidPurchaseStatus(refundedAmountCents, purchase.pricePaidCents),
        refundedAt: fullyRefunded ? purchase.refundedAt ?? new Date() : null,
      },
    });
  }, { isolationLevel: "Serializable" });
}
