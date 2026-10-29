import { createHash } from "node:crypto";
import { matchesPublicStripePrice } from "./publicStripePrice";
import { validAnniversaryServicePeriod } from "./newTestSubscription/anniversaryWindow";
import type { PublicCollectedCoverage } from "./publicSubscriptionAllowance";

/** Pure validation, not entitlement authority. Inputs must come from bounded,
 * authenticated Stripe retrieval in the configured account/API version. The
 * durable service owns enrollment, original Checkout proof and event fencing. */
export type PublicSubscriptionBinding = Readonly<{
  policy: "axiom_public_anniversary_v1"; enrollmentId: string; organizationId: string;
  accountId: string; livemode: boolean; intentId: string; contractId: string;
  sessionId: string; customerId: string; subscriptionId: string;
  planId: "pro" | "enterprise"; interval: "monthly" | "annual";
  paidSeats: number; priceId: string; productId: string; unitAmountCents: number;
  originalCreateProofDigest: string;
}>;
export type PublicPaymentObjects = { subscription: unknown; invoice: unknown; payment: unknown; charge: unknown };
export type PublicSubscriptionObservation =
  | { kind: "collected"; status: "active"; anchor: string; cancelAtPeriodEnd: boolean; coverage: PublicCollectedCoverage; paymentIntentId: string; chargeId: string; lineId: string }
  | { kind: "unavailable"; status: "past_due" | "canceled" | "no_plan"; reason: "subscription_inactive" | "collection_unverified" | "unsupported_terms" };
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const id = (v: unknown): string | null => typeof v === "string" ? v : typeof object(v).id === "string" ? object(v).id as string : null;
const finiteCents = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function iso(seconds: unknown): string | null {
  if (!Number.isSafeInteger(seconds) || (seconds as number) <= 0) return null;
  const d = new Date((seconds as number) * 1000);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function onlyItem(v: unknown): Record<string, unknown> | null {
  const o = object(v);
  return o.has_more === false && Array.isArray(o.data) && o.data.length === 1 ? object(o.data[0]) : null;
}
export function observePublicSubscription(binding: PublicSubscriptionBinding, values: PublicPaymentObjects, now: Date): PublicSubscriptionObservation {
  if (!Number.isFinite(now.getTime()) || binding.policy !== "axiom_public_anniversary_v1" || typeof binding.livemode !== "boolean"
    || !Number.isSafeInteger(binding.paidSeats) || binding.paidSeats < 1 || !/^[a-f0-9]{64}$/.test(binding.originalCreateProofDigest)) throw new Error("public_subscription_binding_mismatch");
  const s = object(values.subscription), meta = object(s.metadata);
  if (s.id !== binding.subscriptionId || id(s.customer) !== binding.customerId || s.livemode !== binding.livemode
    || meta.organizationId !== binding.organizationId || meta.intentId !== binding.intentId || meta.billingPolicy !== binding.policy) throw new Error("public_subscription_binding_mismatch");
  const unavailable = (reason: "subscription_inactive" | "collection_unverified" | "unsupported_terms"): PublicSubscriptionObservation => ({ kind: "unavailable", status: ["canceled", "incomplete_expired"].includes(String(s.status)) ? "canceled" : ["past_due", "unpaid"].includes(String(s.status)) ? "past_due" : "no_plan", reason });
  if (s.status !== "active" || s.pause_collection != null) return unavailable("subscription_inactive");
  const item = onlyItem(s.items), price = object(item?.price);
  if (meta.planId !== binding.planId || meta.billingInterval !== binding.interval || item?.quantity !== binding.paidSeats || id(price.product) !== binding.productId
    || !matchesPublicStripePrice(price, { planId: binding.planId, interval: binding.interval, expectedPriceId: binding.priceId, livemode: binding.livemode }, false)
    || price.unit_amount !== binding.unitAmountCents) return unavailable("unsupported_terms");
  const anchor = iso(s.billing_cycle_anchor), serviceStart = iso(s.current_period_start), serviceEnd = iso(s.current_period_end);
  if (!anchor || !serviceStart || !serviceEnd || typeof s.cancel_at_period_end !== "boolean"
    || !validAnniversaryServicePeriod(anchor, binding.interval, serviceStart, serviceEnd)
    || now < new Date(serviceStart) || now >= new Date(serviceEnd)) return unavailable("collection_unverified");
  return verifyCollectedInvoice(binding,values,{anchor,serviceStart,serviceEnd,expectedInvoiceId:id(s.latest_invoice),subscriptionItemId:String(item?.id),cancelAtPeriodEnd:s.cancel_at_period_end},now) ?? unavailable("collection_unverified");
}

function verifyCollectedInvoice(binding:PublicSubscriptionBinding,values:PublicPaymentObjects,period:{anchor:string;serviceStart:string;serviceEnd:string;expectedInvoiceId:string|null;subscriptionItemId:string;cancelAtPeriodEnd:boolean},now:Date):Extract<PublicSubscriptionObservation,{kind:"collected"}>|null {
  const {anchor,serviceStart,serviceEnd,expectedInvoiceId,subscriptionItemId,cancelAtPeriodEnd}=period;
  const invoice = object(values.invoice), line = onlyItem(invoice.lines), payment = object(values.payment), charge = object(values.charge);
  const total = binding.unitAmountCents * binding.paidSeats, collectedAt = iso(object(invoice.status_transitions).paid_at);
  if (!finiteCents(total) || total < 1 || typeof invoice.id !== "string" || expectedInvoiceId !== invoice.id
    || id(invoice.subscription) !== binding.subscriptionId || id(invoice.customer) !== binding.customerId || invoice.livemode !== binding.livemode
    || invoice.status !== "paid" || invoice.paid !== true || invoice.paid_out_of_band !== false || invoice.collection_method !== "charge_automatically"
    || invoice.currency !== "usd" || invoice.amount_paid !== total || invoice.amount_due !== total || invoice.amount_remaining !== 0
    || invoice.subtotal !== total || invoice.total !== total || invoice.starting_balance !== 0 || !(invoice.ending_balance == null || invoice.ending_balance === 0)
    || invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0
    || !Array.isArray(invoice.total_discount_amounts) || invoice.total_discount_amounts.length !== 0
    || !collectedAt || new Date(collectedAt) < new Date(serviceStart) || new Date(collectedAt) > now) return null;
  if (!line || typeof line.id !== "string" || line.type !== "subscription" || id(line.subscription) !== binding.subscriptionId
    || line.subscription_item !== subscriptionItemId || line.quantity !== binding.paidSeats || line.amount !== total || line.currency !== "usd" || line.proration !== false
    || iso(object(line.period).start) !== serviceStart || iso(object(line.period).end) !== serviceEnd
    || !matchesPublicStripePrice(line.price, { planId: binding.planId, interval: binding.interval, expectedPriceId: binding.priceId, livemode: binding.livemode }, false)
    || id(object(line.price).product) !== binding.productId) return null;
  if (typeof payment.id !== "string" || id(invoice.payment_intent) !== payment.id || payment.livemode !== binding.livemode || payment.status !== "succeeded"
    || id(payment.customer) !== binding.customerId || id(payment.invoice) !== invoice.id || payment.currency !== "usd" || payment.amount !== total || payment.amount_received !== total
    || typeof charge.id !== "string" || id(invoice.charge) !== charge.id || id(payment.latest_charge) !== charge.id
    || charge.livemode !== binding.livemode || charge.status !== "succeeded" || charge.paid !== true || charge.captured !== true
    || id(charge.customer) !== binding.customerId || id(charge.invoice) !== invoice.id || id(charge.payment_intent) !== payment.id
    || charge.currency !== "usd" || charge.amount !== total || charge.amount_captured !== total || charge.amount_refunded !== 0 || charge.refunded !== false || charge.disputed !== false) return null;
  const receipt = { accountId: binding.accountId, livemode: binding.livemode, organizationId: binding.organizationId, subscriptionId: binding.subscriptionId, customerId: binding.customerId,
    priceId: binding.priceId, productId: binding.productId, paidSeats: binding.paidSeats, invoiceId: invoice.id, lineId: line.id, paymentIntentId: payment.id, chargeId: charge.id,
    amountCents: total, serviceStart, serviceEnd, collectedAt };
  return { kind: "collected", status: "active", anchor, cancelAtPeriodEnd: cancelAtPeriodEnd,
    paymentIntentId: payment.id, chargeId: charge.id, lineId: line.id,
    coverage: { kind: "collected", livemode: binding.livemode, status: "active", enrollmentId: binding.enrollmentId, organizationId: binding.organizationId,
      accountId: binding.accountId, contractId: binding.contractId, subscriptionId: binding.subscriptionId, priceId: binding.priceId, paidSeats: binding.paidSeats,
      originalCreateProofDigest: binding.originalCreateProofDigest, invoiceId: invoice.id, evidenceDigest: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"), amountCents: total, serviceStart, serviceEnd, collectedAt } };
}

/** Historical original collection is verified from the invoice linked by the
 * original Checkout session. It is not inferred from a later renewal. */
export function observeOriginalPublicCollection(binding:PublicSubscriptionBinding,values:PublicPaymentObjects,anchorSeconds:unknown,subscriptionItemId:string,originalInvoiceId:string,now:Date):PublicCollectedCoverage|null {
  const invoice=object(values.invoice),line=onlyItem(invoice.lines),anchor=iso(anchorSeconds),serviceStart=iso(object(line?.period).start),serviceEnd=iso(object(line?.period).end);
  if(!Number.isFinite(now.getTime())||!anchor||serviceStart!==anchor||!serviceEnd||invoice.id!==originalInvoiceId||invoice.billing_reason!=="subscription_create"||!validAnniversaryServicePeriod(anchor,binding.interval,serviceStart,serviceEnd))return null;
  return verifyCollectedInvoice(binding,values,{anchor,serviceStart,serviceEnd,expectedInvoiceId:originalInvoiceId,subscriptionItemId,cancelAtPeriodEnd:false},now)?.coverage??null;
}
