import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { findAddOn } from "./addOnCatalog";
import { aiCreditRefundAmount } from "./aiCreditRefundAmount";
import type { PublicBillingIdentity } from "./publicCheckoutService";
import { lockPublicOrganization, type PublicSql, type PublicSqlRepository } from "./publicBillingStore";

export const automaticTopUpPurpose = "axiom_auto_ai_credit_top_up_v1";
export type AutomaticTopUpRefundCharge = Partial<Pick<Stripe.Charge,
  "id" | "object" | "livemode" | "status" | "amount" | "amount_captured" | "paid" | "captured" | "refunded" | "payment_method"
>> & {
  currency?: string | null;
  customer?: string;
  payment_intent?: string | { id?: string } | null;
  amount_refunded?: number | null;
  metadata?: { purpose?: string; organizationId?: string; intentId?: string; sku?: string };
};

export function verifiedAutomaticTopUpCharge(charge: AutomaticTopUpRefundCharge) {
  const { id, metadata, amount } = charge;
  const paymentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  const { organizationId, intentId, sku } = metadata ?? {};
  const pack = typeof sku === "string" ? findAddOn(sku) : null;
  if (!organizationId || !intentId || metadata?.purpose !== automaticTopUpPurpose
      || charge.object !== "charge" || charge.livemode !== false || charge.status !== "succeeded"
      || !id || !/^ch_[A-Za-z0-9]+$/.test(id) || !paymentId || !/^pi_[A-Za-z0-9]+$/.test(paymentId)
      || typeof charge.customer !== "string" || typeof charge.payment_method !== "string"
      || charge.paid !== true || charge.captured !== true || charge.currency !== "usd"
      || pack?.category !== "ai_credits" || amount !== pack.priceCents || charge.amount_captured !== amount) return null;
  return { id, organizationId, intentId, sku: pack.sku, amount, pack, paymentId,
    customer: charge.customer, paymentMethod: charge.payment_method };
}

export async function lockAutomaticTopUpCharge(
  tx: PublicSql, identity: PublicBillingIdentity, charge: NonNullable<ReturnType<typeof verifiedAutomaticTopUpCharge>>,
) {
  const { id, organizationId, intentId, sku, amount, paymentId } = charge;
  await lockPublicOrganization(tx, organizationId);
  const [claim] = await tx.$queryRawUnsafe<Array<{
    state: string; providerKey: string; paymentIntentId: string | null; requestJson: string; requestDigest: string;
    refundChargeId: string | null; refundedAmountCents: number;
  }>>(`
    SELECT i.state,c."providerKey",c."paymentIntentId",c."requestJson",c."requestDigest",c."refundChargeId",c."refundedAmountCents"
    FROM "AutomaticAICreditDispatchClaim" c
    JOIN "AutomaticAICreditTopUpIntent" i ON i.id=c."intentId" AND i."organizationId"=c."organizationId"
    WHERE c."intentId"=$1 AND c."organizationId"=$2 AND c."accountId"=$3 AND i.sku=$4 AND i."amountCents"=$5
      AND i.state IN ('dispatch_unknown','authentication_required','payment_failed','paid')
    FOR UPDATE OF c,i
  `, intentId, organizationId, identity.accountId, sku, amount);
  if (!claim || createHash("sha256").update(claim.requestJson).digest("hex") !== claim.requestDigest) return "invalid";
  const request = JSON.parse(claim.requestJson) as Stripe.PaymentIntentCreateParams;
  if (request.metadata?.purpose !== automaticTopUpPurpose || request.metadata.intentId !== intentId
      || request.metadata.organizationId !== organizationId || request.metadata.sku !== sku
      || request.currency !== "usd" || request.amount !== amount
      || request.customer !== charge.customer || request.payment_method !== charge.paymentMethod
      || (claim.refundChargeId && claim.refundChargeId !== id)) return "invalid";
  if (!claim.paymentIntentId) return "payment_unbound";
  return claim.paymentIntentId === paymentId ? claim : "invalid";
}

export async function automaticTopUpDisputeAdjustment(tx: PublicSql, intentId: string, chargeId: string, priceCents: number) {
  const [row] = await tx.$queryRawUnsafe<Array<{ bound: boolean; mismatch: boolean; held: boolean; lost: number }>>(`
    SELECT count(*) > 0 AS bound,COALESCE(bool_or("chargeId"<>$2),false) AS mismatch,
      COALESCE(bool_or(state IN ('held','inquiry')),false) AS held,
      LEAST($3::bigint,COALESCE(sum("amountCents") FILTER(WHERE state='lost'),0))::int AS lost
    FROM "AutomaticAICreditDispute" WHERE "intentId"=$1
  `, intentId, chargeId, priceCents);
  if (row.mismatch) throw Error("automatic_top_up_dispute_charge_mismatch");
  return { bound: row.bound, unavailableCents: row.held ? priceCents : row.lost };
}

/** Called after the webhook verifies the signature, account, mode, and schema. */
export async function recordAutomaticTopUpTestRefund(
  repo: PublicSqlRepository,
  identity: PublicBillingIdentity,
  eventId: string,
  charge: AutomaticTopUpRefundCharge,
) {
  const bound = verifiedAutomaticTopUpCharge(charge);
  const refunded = charge.amount_refunded;
  if (!bound || identity.livemode !== false || !/^evt_[A-Za-z0-9_]{1,180}$/.test(eventId)
      || typeof refunded !== "number" || !Number.isSafeInteger(refunded) || refunded <= 0 || refunded > bound.amount
      || charge.refunded !== (refunded === bound.amount)) return "invalid";
  const { id, organizationId, intentId, sku, paymentId, pack } = bound;
  return repo.$transaction(async tx => {
    const claim = await lockAutomaticTopUpCharge(tx, identity, bound);
    if (typeof claim === "string") return claim;

    const recorded = await tx.$executeRawUnsafe(`
      INSERT INTO "StripeBillingEvent" (id,type) VALUES ($1,'charge.refunded') ON CONFLICT (id) DO NOTHING
    `, eventId);
    if (!recorded) return "replay";
    const [updated] = await tx.$queryRawUnsafe<Array<{ refundedAmountCents: number }>>(`
      UPDATE "AutomaticAICreditDispatchClaim"
      SET "refundChargeId"=$1,"refundedAmountCents"=GREATEST("refundedAmountCents",$2)
      WHERE "intentId"=$3
      RETURNING "refundedAmountCents"
    `, id, refunded, intentId);
    const dispute = await automaticTopUpDisputeAdjustment(tx, intentId, id, pack.priceCents);
    if (claim.state === "paid") {
      const reversal = aiCreditRefundAmount(updated.refundedAmountCents, pack.priceCents, pack.deliveredAICreditsCents);
      const combined = aiCreditRefundAmount(reversal.refundedAmountCents + dispute.unavailableCents, pack.priceCents, pack.deliveredAICreditsCents);
      const changed = await tx.$executeRawUnsafe(`
        UPDATE "AddOnPurchase" SET "refundedAmountCents"=GREATEST("refundedAmountCents",$1),
          "reversedAICreditsCents"=GREATEST("reversedAICreditsCents",$2),
          status=CASE WHEN "refundedAmountCents"<=$1 THEN $3 ELSE status END,
          "refundedAt"=CASE WHEN $3='refunded' THEN COALESCE("refundedAt",clock_timestamp() AT TIME ZONE 'UTC') ELSE "refundedAt" END,
          "updatedAt"=clock_timestamp() AT TIME ZONE 'UTC'
        WHERE id=$4 AND "organizationId"=$5 AND "stripePaymentIntentId"=$6 AND sku=$7
          AND "pricePaidCents"=$8 AND "deliveredAICreditsCents"=$9 AND "appliedAt" IS NOT NULL
          AND status IN ('paid','partially_refunded','refunded')
      `, reversal.refundedAmountCents, combined.reversedAICreditsCents, reversal.status,
      claim.providerKey, organizationId, paymentId, sku, pack.priceCents, pack.deliveredAICreditsCents);
      if (changed !== 1) throw new Error("automatic_top_up_refund_ledger_mismatch");
    }
    return "recorded";
  }, { isolationLevel: "Serializable" });
}
