import type Stripe from "stripe";
import { collectedEvidence, type PaidIdentity, type CollectionResult } from "./paidCoverage";

export type BoundedRead = <T>(operation: (timeout: number) => Promise<T>) => Promise<T>;
const fail = (code: string): never => { throw new Error(code); };
const id = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
const empty = (value: unknown) => Array.isArray(value) && value.length === 0;
const none = (value: unknown) => value === null || empty(value);
const timestamp = (seconds: unknown) => typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0 && Number.isFinite(new Date(seconds * 1000).getTime());
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
/** Installed SDK 20 collection shape only. Every remote call is owned by the
 * enclosing bounded, runtime-guarded reader; no pagination or ambient auth. */
export async function retrieveCollectedCoverage(stripe: Stripe, identity: PaidIdentity, sub: Stripe.Subscription, read: BoundedRead): Promise<{ latestInvoiceId: string | null; currentPeriodStart: string; currentPeriodEnd: string; collection: CollectionResult }> {
  const item = sub.items.data[0];
  if (!item || !timestamp(item.current_period_start) || !timestamp(item.current_period_end) || item.current_period_start >= item.current_period_end) fail("subscription_snapshot_invalid");
  const invoiceId = id(sub.latest_invoice);
  const base = { latestInvoiceId: invoiceId ?? null, currentPeriodStart: iso(item.current_period_start), currentPeriodEnd: iso(item.current_period_end) };
  const negative = (reason: "not_collected" | "unsupported_collection" | "refunded_or_disputed") => ({ ...base, collection: { kind: "unavailable" as const, reason } });
  if (!invoiceId) return negative("not_collected");
  const invoice = await read(timeout => stripe.invoices.retrieve(invoiceId, {}, { timeout, maxNetworkRetries: 0 }));
  if (invoice.id !== invoiceId || invoice.livemode !== false || id(invoice.customer) !== identity.customerId || invoice.parent?.type !== "subscription_details" || id(invoice.parent.subscription_details?.subscription) !== identity.subscriptionId) fail("collection_identity_mismatch");
  if (invoice.status !== "paid") return negative("not_collected");
  const amount = identity.unitAmountCents * identity.seatQuantity;
  if (invoice.collection_method !== "charge_automatically" || invoice.currency !== "usd" || invoice.amount_due !== amount || invoice.amount_paid !== amount || invoice.amount_remaining !== 0 || invoice.amount_overpaid !== 0 || invoice.starting_balance !== 0 || invoice.ending_balance !== 0 || invoice.subtotal !== amount || invoice.total !== amount || invoice.pre_payment_credit_notes_amount !== 0 || invoice.post_payment_credit_notes_amount !== 0 || !empty(invoice.discounts) || !none(invoice.total_discount_amounts) || !none(invoice.total_pretax_credit_amounts) || !none(invoice.total_taxes) || invoice.automatic_tax?.enabled === true || !timestamp(invoice.status_transitions.paid_at) || !timestamp(invoice.status_transitions.finalized_at) || invoice.status_transitions.paid_at! < invoice.status_transitions.finalized_at!) return negative("unsupported_collection");
  if (!invoice.lines || invoice.lines.has_more !== false || !Array.isArray(invoice.lines.data) || invoice.lines.data.length !== 1) return negative("unsupported_collection");
  const line = invoice.lines.data[0]; const details = line.parent?.subscription_item_details;
  if (line.parent?.type !== "subscription_item_details" || details?.subscription !== identity.subscriptionId || details?.subscription_item !== item.id || line.pricing?.type !== "price_details" || id(line.pricing.price_details?.price) !== identity.priceId || line.pricing.price_details?.product !== id(item.price.product)) fail("collection_identity_mismatch");
  if (details.proration !== false || line.currency !== "usd" || line.amount !== amount || line.subtotal !== amount || line.quantity !== identity.seatQuantity || line.pricing?.unit_amount_decimal !== String(identity.unitAmountCents) || !empty(line.discounts) || !none(line.discount_amounts) || !none(line.pretax_credit_amounts) || !none(line.taxes) || line.period.start !== item.current_period_start || line.period.end !== item.current_period_end) return negative("unsupported_collection");
  const payments = await read(timeout => stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 2 }, { timeout, maxNetworkRetries: 0 }));
  if (payments.has_more !== false || payments.data.length !== 1) return negative("unsupported_collection");
  const payment = payments.data[0];
  if (payment.livemode !== false || id(payment.invoice) !== invoiceId) fail("collection_identity_mismatch");
  if (payment.status !== "paid" || payment.currency !== "usd" || payment.amount_requested !== amount || payment.amount_paid !== amount || payment.payment.type !== "payment_intent" || !timestamp(payment.status_transitions.paid_at)) return negative("unsupported_collection");
  const paymentIntentId = id(payment.payment.payment_intent); if (!paymentIntentId) return negative("unsupported_collection");
  const pi = await read(timeout => stripe.paymentIntents.retrieve(paymentIntentId, {}, { timeout, maxNetworkRetries: 0 }));
  if (pi.id !== paymentIntentId || pi.livemode !== false || id(pi.customer) !== identity.customerId) fail("collection_identity_mismatch");
  if (pi.status !== "succeeded" || pi.currency !== "usd" || pi.amount !== amount || pi.amount_received !== amount || pi.amount_capturable !== 0 || !id(pi.latest_charge)) return negative("unsupported_collection");
  const chargeId = id(pi.latest_charge)!;
  const charge = await read(timeout => stripe.charges.retrieve(chargeId, {}, { timeout, maxNetworkRetries: 0 }));
  if (charge.id !== chargeId || charge.livemode !== false || id(charge.customer) !== identity.customerId || id(charge.payment_intent) !== paymentIntentId) fail("collection_identity_mismatch");
  if (charge.refunded !== false || charge.disputed !== false || charge.amount_refunded !== 0) return negative("refunded_or_disputed");
  if (charge.currency !== "usd" || charge.amount !== amount || charge.amount_captured !== amount || charge.paid !== true || charge.captured !== true) return negative("unsupported_collection");
  const finalInvoice = await read(timeout => stripe.invoices.retrieve(invoiceId, {}, { timeout, maxNetworkRetries: 0 }));
  const finalCharge = await read(timeout => stripe.charges.retrieve(chargeId, {}, { timeout, maxNetworkRetries: 0 }));
  if (JSON.stringify(finalInvoice) !== JSON.stringify(invoice) || JSON.stringify(finalCharge) !== JSON.stringify(charge)) fail("collection_snapshot_changed");
  try {
    const evidence = collectedEvidence({ ...identity, invoiceId, lineId: line.id, subscriptionItemId: item.id, paymentId: payment.id, paymentIntentId, chargeId, currency: "usd", amountCents: amount, collectedAt: iso(Math.max(invoice.status_transitions.paid_at!, payment.status_transitions.paid_at!)), serviceStart: iso(line.period.start), serviceEnd: iso(line.period.end) });
    return { ...base, collection: { kind: "collected", evidence } };
  } catch { return negative("unsupported_collection"); }
}
