import "server-only";

import { aiCreditRefundAmount } from "./aiCreditRefundAmount";
import { automaticTopUpDisputeAdjustment, lockAutomaticTopUpCharge, verifiedAutomaticTopUpCharge, type AutomaticTopUpRefundCharge } from "./automaticAICreditTopUpRefund";
import type { PublicBillingIdentity } from "./publicCheckoutService";
import type { PublicSqlRepository } from "./publicBillingStore";

type Dispute = {
  id?: string;
  object?: string;
  livemode?: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  charge?: unknown;
  payment_intent?: unknown;
};

const reference = (value: unknown) => typeof value === "string" ? value
  : value && typeof value === "object" && "id" in value ? value.id : null;

/** Uses canonical dispute and charge reads resolved by the signed webhook. */
export async function recordAutomaticTopUpTestDispute(
  repo: PublicSqlRepository,
  identity: PublicBillingIdentity,
  event: { id: string; type: string },
  dispute: Dispute,
  charge: AutomaticTopUpRefundCharge,
) {
  const bound = verifiedAutomaticTopUpCharge(charge);
  const amount = dispute.amount;
  const refunded = charge.amount_refunded;
  const state = dispute.status === "won" || dispute.status === "warning_closed" ? dispute.status
    : dispute.status === "lost" ? "lost"
    : dispute.status === "warning_needs_response" || dispute.status === "warning_under_review" ? "inquiry"
    : ["needs_response", "under_review", "prevented"].includes(dispute.status ?? "") ? "held" : null;
  if (!bound || identity.livemode !== false || dispute.livemode !== false
      || dispute.object !== "dispute" || !dispute.id || !/^du_[A-Za-z0-9]+$/.test(dispute.id)
      || !/^evt_[A-Za-z0-9_]{1,180}$/.test(event.id) || !state || dispute.currency !== "usd"
      || reference(dispute.charge) !== bound.id || reference(dispute.payment_intent) !== bound.paymentId
      || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > bound.amount
      || typeof refunded !== "number" || !Number.isSafeInteger(refunded) || refunded < 0 || refunded > bound.amount
      || charge.refunded !== (refunded === bound.amount)) return "invalid";

  const { organizationId, intentId, paymentId, sku, pack, id: chargeId } = bound;
  return repo.$transaction(async tx => {
    const claim = await lockAutomaticTopUpCharge(tx, identity, bound);
    if (typeof claim === "string") return claim;
    const recorded = await tx.$executeRawUnsafe(`
      INSERT INTO "StripeBillingEvent" (id,type) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING
    `, event.id, event.type);
    if (!recorded) return "replay";
    const wrote = await tx.$executeRawUnsafe(`
      INSERT INTO "AutomaticAICreditDispute" (id,"intentId","chargeId","amountCents",state)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state,"amountCents"=EXCLUDED."amountCents"
      WHERE "AutomaticAICreditDispute"."intentId"=EXCLUDED."intentId"
        AND "AutomaticAICreditDispute"."chargeId"=EXCLUDED."chargeId"
        AND ("AutomaticAICreditDispute".state='inquiry'
          OR ("AutomaticAICreditDispute".state=EXCLUDED.state AND
            ("AutomaticAICreditDispute".state='held' OR "AutomaticAICreditDispute"."amountCents"=EXCLUDED."amountCents"))
          OR ("AutomaticAICreditDispute".state='warning_closed' AND EXCLUDED.state IN ('held','won','lost'))
          OR ("AutomaticAICreditDispute".state='held' AND EXCLUDED.state IN ('won','lost')))
    `, dispute.id, intentId, chargeId, amount, state);
    if (!wrote) {
      // A stale canonical read cannot reopen or replace a final decision.
      const [previous] = await tx.$queryRawUnsafe<Array<{ chargeId: string; intentId: string }>>(
        'SELECT "chargeId","intentId" FROM "AutomaticAICreditDispute" WHERE id=$1', dispute.id,
      );
      if (state !== "won" && state !== "lost" && previous?.intentId === intentId && previous.chargeId === chargeId) return "stale";
      throw Error("automatic_top_up_dispute_conflict");
    }

    // Serializes both sides of settlement even if its transaction started
    // before this dispute receipt committed.
    await tx.$executeRawUnsafe(`
      UPDATE "AutomaticAICreditDispatchClaim" SET "disputeRevision"="disputeRevision"+1 WHERE "intentId"=$1
    `, intentId);
    const adjustment = await automaticTopUpDisputeAdjustment(tx, intentId, chargeId, pack.priceCents);
    if (claim.state === "paid") {
      const [ledger] = await tx.$queryRawUnsafe<Array<{ refundedAmountCents: number }>>(`
        SELECT "refundedAmountCents" FROM "AddOnPurchase"
        WHERE id=$1 AND "organizationId"=$2 AND "stripePaymentIntentId"=$3 AND sku=$4
          AND "pricePaidCents"=$5 AND "deliveredAICreditsCents"=$6 AND "appliedAt" IS NOT NULL FOR UPDATE
      `, claim.providerKey, organizationId, paymentId, sku, pack.priceCents, pack.deliveredAICreditsCents);
      if (!ledger) throw Error("automatic_top_up_dispute_ledger_missing");
      const refund = aiCreditRefundAmount(Math.max(refunded, claim.refundedAmountCents, ledger.refundedAmountCents),
        pack.priceCents, pack.deliveredAICreditsCents);
      const reversal = aiCreditRefundAmount(refund.refundedAmountCents + adjustment.unavailableCents,
        pack.priceCents, pack.deliveredAICreditsCents);
      await tx.$executeRawUnsafe(`
        UPDATE "AddOnPurchase" SET "refundedAmountCents"=$2,"reversedAICreditsCents"=$3,status=$4,
          "refundedAt"=CASE WHEN $4='refunded' THEN COALESCE("refundedAt",clock_timestamp() AT TIME ZONE 'UTC') ELSE "refundedAt" END,
          "updatedAt"=clock_timestamp() AT TIME ZONE 'UTC'
        WHERE id=$1
      `, claim.providerKey, refund.refundedAmountCents, reversal.reversedAICreditsCents, refund.status);
    }
    return "recorded";
  }, { isolationLevel: "Serializable" });
}
