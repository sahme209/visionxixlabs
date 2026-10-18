/** Owned TEST worker fixture only: explicitly synthetic remote replies, local
 * installed-SDK signatures. No ambient credential or native HTTP path exists. */
import Stripe from "stripe";
import { PUBLIC_PLAN_CATALOG } from "../../publicPlanCatalog";
import { createStripeTestProvider } from "../../newTestSubscription/stripeTestProvider";
import type { Store } from "../../newTestSubscription/service";
import type { Manifest } from "../../ownedCheckoutBridge/protocol";
export const ownedSyntheticWebhookSecret = "whsec_synthetic_owned_checkout_v1";
export function ownedSyntheticPriceMap(manifest: Manifest): Record<string, string> {
  if (manifest.accountId !== "acct-test") throw new Error("owned_synthetic_scope_required");
  return Object.fromEntries(["pro", "enterprise"].flatMap(plan => ["monthly", "annual"].map(interval => [`${plan}:${interval}`, `price_owned_synthetic_${plan}_${interval}`])));
}
export function ownedSyntheticProvider(store: Store, manifest: Manifest) {
  const prices = ownedSyntheticPriceMap(manifest), sdk = new Stripe("sk_test_synthetic_owned_checkout_v1");
  const sessionId = `cs_owned_${manifest.session}`, customerId = `cus_owned_${manifest.session}`, subscriptionId = `sub_owned_${manifest.session}`;
  let selected: ReturnType<typeof price> | null = null, request: Stripe.Checkout.SessionCreateParams | null = null, period: { start: number; end: number } | null = null;
  function price(id: string) {
    const key = Object.keys(prices).find(k => prices[k] === id); if (!key) throw new Error("owned_synthetic_price_required");
    const [planId, interval] = key.split(":"), plan = PUBLIC_PLAN_CATALOG.find(p => p.id === planId)!;
    return { id, livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: interval === "annual" ? plan.annualPricePerUserCents * 12 : plan.monthlyPricePerUserCents, recurring: { interval: interval === "annual" ? "year" : "month", interval_count: 1, usage_type: "licensed" }, product: { id: `prod_owned_synthetic_${planId}`, active: true, livemode: false } };
  }
  function snapshots() {
    if (!selected || !request || !period || !request.line_items?.[0].quantity) throw new Error("owned_synthetic_checkout_not_created");
    const quantity = request.line_items[0].quantity, amount = selected.unit_amount * quantity, invoiceId = `in_owned_${manifest.session}`, pi = `pi_owned_${manifest.session}`, chargeId = `ch_owned_${manifest.session}`;
    const line = { id: `il_owned_${manifest.session}`, amount, subtotal: amount, currency: "usd", quantity, period, discounts: [], discount_amounts: [], pretax_credit_amounts: [], taxes: [], parent: { type: "subscription_item_details", subscription_item_details: { subscription: subscriptionId, subscription_item: "si_owned", proration: false } }, pricing: { type: "price_details", price_details: { price: selected.id, product: selected.product.id }, unit_amount_decimal: String(selected.unit_amount) } };
    const invoice = { id: invoiceId, livemode: false, customer: customerId, parent: { type: "subscription_details", subscription_details: { subscription: subscriptionId } }, status: "paid", collection_method: "charge_automatically", currency: "usd", amount_due: amount, amount_paid: amount, amount_remaining: 0, amount_overpaid: 0, starting_balance: 0, ending_balance: 0, subtotal: amount, total: amount, pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0, discounts: [], total_discount_amounts: [], total_pretax_credit_amounts: [], total_taxes: [], automatic_tax: { enabled: false }, status_transitions: { finalized_at: period.start, paid_at: period.start }, lines: { has_more: false, data: [line] } };
    const payments = { has_more: false, data: [{ id: `inpay_owned_${manifest.session}`, livemode: false, invoice: invoiceId, amount_paid: amount, amount_requested: amount, currency: "usd", status: "paid", status_transitions: { paid_at: period.start }, payment: { type: "payment_intent", payment_intent: pi } }] };
    const paymentIntent = { id: pi, livemode: false, customer: customerId, status: "succeeded", currency: "usd", amount, amount_received: amount, amount_capturable: 0, latest_charge: chargeId };
    const charge = { id: chargeId, livemode: false, customer: customerId, payment_intent: pi, currency: "usd", amount, amount_captured: amount, amount_refunded: 0, paid: true, captured: true, refunded: false, disputed: false, payment_method_details: { type: "card", card: {} } };
    const session = { id: sessionId, invoice: invoiceId, livemode: false, mode: "subscription", status: "complete", payment_status: "paid", customer: customerId, subscription: subscriptionId, metadata: request.metadata, line_items: { has_more: false, data: [{ quantity, price: selected }] } };
    const subscription = { id: subscriptionId, customer: customerId, livemode: false, latest_invoice: invoiceId, metadata: request.subscription_data?.metadata, status: "active", cancel_at_period_end: false, billing_cycle_anchor: period.start, start_date: period.start, billing_cycle_anchor_config: null, trial_start: null, trial_end: null, items: { has_more: false, data: [{ id: "si_owned", quantity, price: selected, current_period_start: period.start, current_period_end: period.end }] } };
    return { session, subscription, invoice, payments, paymentIntent, charge };
  }
  const client = { accounts: { retrieve: async () => ({ id: manifest.accountId }) }, prices: { retrieve: async (id: string) => price(id) }, webhooks: sdk.webhooks,
    checkout: { sessions: { retrieve: async () => structuredClone(snapshots().session), create: async (input: Stripe.Checkout.SessionCreateParams, opts: Stripe.RawRequestOptions) => {
      if (request) throw new Error("owned_synthetic_repeat_create_denied");
      selected = price(String(input.line_items?.[0].price)); request = structuredClone(input);
      const now = await store.transaction(tx => tx.currentTime()), start = new Date(Math.floor(now.getTime() / 1000) * 1000), month = start.getUTCMonth() + (selected.recurring.interval === "year" ? 12 : 1), day = Math.min(start.getUTCDate(), new Date(Date.UTC(start.getUTCFullYear(), month + 1, 0)).getUTCDate());
      const end = new Date(Date.UTC(start.getUTCFullYear(), month, day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds())); period = { start: start.getTime() / 1000, end: end.getTime() / 1000 };
      return { id: sessionId, livemode: false, url: "https://checkout.stripe.com/synthetic-owned-http-only", lastResponse: { requestId: `req_synthetic_owned_${manifest.session}`, statusCode: 200, idempotencyKey: opts.idempotencyKey } };
    } } }, subscriptions: { retrieve: async () => structuredClone(snapshots().subscription) }, invoices: { retrieve: async () => structuredClone(snapshots().invoice) }, invoicePayments: { list: async () => structuredClone(snapshots().payments) }, paymentIntents: { retrieve: async () => structuredClone(snapshots().paymentIntent) }, charges: { retrieve: async () => structuredClone(snapshots().charge) } };
  return createStripeTestProvider({ secretKey: "sk_test_synthetic_owned_checkout_v1", webhookSecret: ownedSyntheticWebhookSecret, expectedAccountId: manifest.accountId, store, configuredPrices: prices, sdkFactory: () => client as unknown as Stripe });
}
