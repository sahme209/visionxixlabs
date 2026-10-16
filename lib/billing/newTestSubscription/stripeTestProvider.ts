import "server-only";
import Stripe from "stripe";
import { denyIsolatedExternalIO } from "../isolatedApplication/runtime";
import { createHash } from "node:crypto";
import { matchNewTestTerms, NEW_TEST_CATALOG_VERSION } from "../newTestSubscriptionContract";
import { retrieveCollectedCoverage, type BoundedRead } from "./stripePaidCoverage";
import { paidIdentity } from "./paidCoverage";
import { createBoundedStripeHttpClient } from "./stripeHttpClient";
import { withOwnedStripeDeadline, stripeDeadlineOptions } from "./stripeDeadline";
import type { Intent, ProviderBoundary, Store } from "./service";
import { hasOriginalCreateProof, isCollectionEventType, isLifecycleEventType, lifecycleObservation } from "./lifecycle";
function fail(code: string): never { throw new Error(code); }
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
/** Inactive, explicitly constructed internal TEST adapter. Never read ambient
 * keys or attach this to public routes. Store independently owns isolation. */
export function createStripeTestProvider(options: {
  secretKey: string; webhookSecret: string; expectedAccountId: string; store: Store;
  configuredPrices: Record<string, string>; sdkFactory?: (key: string) => Stripe;
}): ProviderBoundary {
  denyIsolatedExternalIO();
  const { secretKey, webhookSecret, expectedAccountId, store, sdkFactory } = options;
  const runtimeId = store.runtimeId;
  const configuredPrices = Object.freeze({ ...options.configuredPrices });
  if (!secretKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_") || !expectedAccountId || !store.runtimeId) fail("test_runtime_unavailable");
  const stripe = sdkFactory ? sdkFactory(secretKey) : new Stripe(secretKey, { timeout: 10_000, maxNetworkRetries: 0, httpClient: createBoundedStripeHttpClient() });
  function runtime() { denyIsolatedExternalIO(); if (store.runtimeId !== runtimeId) fail("test_runtime_changed"); }
  async function single<T>(operation: (opts: Stripe.RawRequestOptions) => Promise<T>) { runtime(); const result = await withOwnedStripeDeadline(performance.now() + 10_000, () => operation(stripeDeadlineOptions(10_000))); runtime(); return result; }
  async function account() { runtime(); const current = await single(opts => stripe.accounts.retrieve({}, opts)); runtime(); if (current.id !== expectedAccountId) fail("test_account_mismatch"); }
  function intentValid(i: Intent | null): i is Intent { return !!i && i.runtimeId === runtimeId && i.accountId === expectedAccountId && i.livemode === false && i.terms.catalogVersion === NEW_TEST_CATALOG_VERSION; }
  async function price(plan: "pro" | "enterprise", interval: "monthly" | "annual") {
    await account();
    runtime();
    const id = configuredPrices[`${plan}:${interval}`]; if (!id) fail("test_price_mismatch");
    const p = await single(opts => stripe.prices.retrieve(id, { expand: ["product"] }, opts));
    runtime();
    const product = p.product;
    if (typeof product === "string" || product.deleted || !product.active || product.livemode !== false || !p.recurring || p.unit_amount === null) fail("test_product_mismatch");
    const snapshot = { ...p, unit_amount: p.unit_amount!, recurring: p.recurring! };
    if (matchNewTestTerms({ planId: plan, interval, seatQuantity: 1, configuredPriceId: id, price: snapshot }).kind !== "supported_terms") fail("test_price_mismatch");
    return snapshot;
  }
  return {
    mode: () => { runtime(); return { livemode: false, accountId: expectedAccountId }; }, price,
    async create(body, key, scope) {
      runtime();
      if (typeof body !== "string" || !body.length || body.length > 16_384 || Buffer.byteLength(body, "utf8") > 16_384 || typeof key !== "string" || !key.length || key.length > 255) fail("provider_input_bounds");
      if (!scope) fail("test_manager_required");
      const request = JSON.parse(body) as Stripe.Checkout.SessionCreateParams;
      const id = request.metadata?.intentId; if (typeof id !== "string") fail("attempt_provenance_unavailable");
      const i = await store.transaction(tx => tx.intent(id));
      if (!intentValid(i) || i.organizationId !== scope!.organizationId || i.state !== "attempted" || i.canonicalRequest !== body || i.requestDigest !== digest(body) || i.providerIdempotencyKey !== key || i.sessionId !== null) fail("attempt_provenance_unavailable");
      async function authority() { runtime(); await store.transaction(async tx => {
        if (!await tx.eligible(scope!) || await tx.acceptedSeats(i!.organizationId) !== i!.terms.seatQuantity) fail("test_manager_required");
        if (await tx.contract(i!.organizationId) || await tx.legacyBinding(i!.organizationId)) fail("existing_customer_unchanged");
        const current = await tx.intent(i!.id);
        if (!current || current.revision !== i!.revision || current.state !== "attempted" || current.canonicalRequest !== body || current.providerIdempotencyKey !== key || current.accountId !== i!.accountId || current.runtimeId !== i!.runtimeId) fail("attempt_provenance_unavailable");
      }); runtime(); }
      await authority();
      await account();
      const configured = await price(i.terms.planId, i.terms.interval);
      if (configured.id !== i.terms.priceId || request.mode !== "subscription" || request.metadata?.organizationId !== i.organizationId || request.metadata?.catalogVersion !== NEW_TEST_CATALOG_VERSION || request.line_items?.length !== 1 || request.line_items[0].price !== i.terms.priceId || request.line_items[0].quantity !== i.terms.seatQuantity) fail("signed_terms_mismatch");
      await authority(); // Fresh local authority after provider reads; no atomic external revocation claim.
      runtime();
      const s = await single(opts => stripe.checkout.sessions.create(request, { ...opts, idempotencyKey: key }));
      await account();
      const response = s.lastResponse;
      if (s.livemode !== false || !s.url || (typeof response?.requestId !== "string" || !response.requestId.trim()) || !Number.isInteger(response.statusCode) || response.statusCode < 200 || response.statusCode >= 300
        || (response.idempotencyKey !== undefined && response.idempotencyKey !== key)
        || (response.stripeAccount !== undefined && response.stripeAccount !== expectedAccountId)) fail("original_create_response_mismatch");
      return { id: s.id, url: s.url!, accountId: expectedAccountId, livemode: false,
        originalCreateProof: { runtimeId: i.runtimeId, accountId: i.accountId, sessionId: s.id, outboundRequestKey: key, outboundRequestDigest: digest(body),
          requestId: response.requestId, statusCode: response.statusCode,
          ...(response.idempotencyKey !== undefined ? { observedIdempotencyKey: response.idempotencyKey } : {}),
          ...(response.stripeAccount !== undefined ? { observedAccountId: response.stripeAccount } : {}), ...(response.apiVersion ? { apiVersion: response.apiVersion } : {}) } };
    },
    async verifyAndRetrieve(raw, signature, organizationId) {
      runtime();
      if (typeof raw !== "string" || !raw.length || raw.length > 262_144 || Buffer.byteLength(raw, "utf8") > 262_144 || typeof signature !== "string" || !signature.length || signature.length > 4096 || Buffer.byteLength(signature, "utf8") > 4096) fail("provider_input_bounds");
      const deadline = performance.now() + 30_000; let reads = 0;
      const read: BoundedRead = async operation => {
        runtime(); const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0 || ++reads > 14) fail("provider_read_budget_exceeded");
        const result = await withOwnedStripeDeadline(Math.min(deadline, performance.now() + 10_000), () => operation(Math.min(10_000, remaining)));
        runtime(); if (performance.now() >= deadline) fail("provider_read_budget_exceeded");
        return result;
      };
      const readAccount = async () => { const a = await read(timeout => stripe.accounts.retrieve({}, stripeDeadlineOptions(timeout))); if (a.id !== expectedAccountId) fail("test_account_mismatch"); };
      const event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
      const lifecycle = isLifecycleEventType(event.type); const collectionEvent = isCollectionEventType(event.type);
      if (!event.id || event.livemode !== false || (event.type !== "checkout.session.completed" && !lifecycle && !collectionEvent) || (event.account && event.account !== expectedAccountId)) fail("signed_binding_mismatch");
      await readAccount();
      const hint = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
      const boundForTrigger = collectionEvent && organizationId ? await store.transaction(tx => tx.contract(organizationId)) : null;
      const intentId = collectionEvent ? boundForTrigger?.originatingIntentId : hint.metadata?.intentId;
      if (!intentId) fail("attempt_provenance_unavailable");
      const i = await store.transaction(tx => tx.intent(intentId));
      const proof = i?.originalCreateProof;
      if (!intentValid(i) || !hasOriginalCreateProof(i) || !proof || organizationId && i.organizationId !== organizationId) fail("attempt_provenance_unavailable");
      let session: Stripe.Checkout.Session | null = null;
      const bound = lifecycle || collectionEvent || i.state === "bound" ? await store.transaction(tx => tx.contract(i.organizationId)) : null;
      if (bound || lifecycle || collectionEvent) {
        if (!bound || i.state !== "bound" || bound.livemode !== false || bound.runtimeId !== runtimeId || bound.accountId !== expectedAccountId
          || bound.organizationId !== i.organizationId || bound.originatingIntentId !== i.id || bound.catalogVersion !== NEW_TEST_CATALOG_VERSION || bound.planId !== i.terms.planId
          || bound.sessionId !== i.sessionId || bound.customerId !== i.customerId || bound.subscriptionId !== i.subscriptionId) fail("signed_binding_mismatch");
        if (lifecycle && (hint.id !== bound.subscriptionId || hint.customer !== bound.customerId || hint.livemode !== false
          || hint.metadata?.organizationId !== i.organizationId || hint.metadata?.catalogVersion !== NEW_TEST_CATALOG_VERSION)) fail("signed_binding_mismatch");
        if (bound.seatQuantity !== i.terms.seatQuantity) fail("seat_change_requires_review");
      }
      if (!lifecycle && !collectionEvent) {
        if (hint.id !== i.sessionId) fail("attempt_provenance_unavailable");
        session = await read(timeout => stripe.checkout.sessions.retrieve(i.sessionId!, { expand: ["line_items"] }, stripeDeadlineOptions(timeout)));
        if (session.livemode !== false || session.mode !== "subscription" || session.id !== proof.sessionId || session.metadata?.intentId !== i.id
          || session.metadata?.organizationId !== i.organizationId || session.metadata?.catalogVersion !== NEW_TEST_CATALOG_VERSION
          || typeof session.customer !== "string" || typeof session.subscription !== "string" || session.status !== "complete" || session.payment_status !== "paid"
          || !session.line_items || session.line_items.has_more !== false || session.line_items.data.length !== 1
          || session.line_items.data[0].price?.id !== i.terms.priceId || session.line_items.data[0].quantity !== i.terms.seatQuantity) fail("signed_binding_mismatch");
      }
      const subscriptionId = bound?.subscriptionId ?? session!.subscription as string;
      const customerId = bound?.customerId ?? session!.customer as string;
      const sub = await read(timeout => stripe.subscriptions.retrieve(subscriptionId, {}, stripeDeadlineOptions(timeout)));
      if (sub.id !== subscriptionId || sub.livemode !== false || sub.customer !== customerId
        || sub.metadata.intentId !== i.id || sub.metadata.organizationId !== i.organizationId || sub.metadata.catalogVersion !== NEW_TEST_CATALOG_VERSION) fail("signed_binding_mismatch");
      if (collectionEvent) {
        const previous = await store.transaction(tx => tx.coverage(i.organizationId));
        const h = event.data.object as unknown as { id: string; invoice?: string; charge?: string; customer?: string; livemode?: boolean; parent?: { type: string; subscription_details?: { subscription?: string } } };
        const reference = event.type.startsWith("invoice.") ? h.id : event.type === "credit_note.created" ? h.invoice : event.type === "charge.refunded" ? h.id : h.charge;
        const latest = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;
        const expected = event.type.startsWith("invoice.") || event.type === "credit_note.created" ? latest : previous?.observation.collection.kind === "collected" ? previous.observation.collection.evidence.chargeId : previous?.originalEvidence.chargeId;
        const linkedInvoice = event.type.startsWith("invoice.") && h.parent?.type === "subscription_details" && h.parent.subscription_details?.subscription === subscriptionId && h.customer === customerId;
        const knownOriginal = event.type.startsWith("invoice.") && reference === previous?.originalEvidence.invoiceId;
        if (!reference || reference !== expected && !linkedInvoice && !knownOriginal || h.livemode !== false || h.customer && h.customer !== customerId) fail("signed_binding_mismatch");
      }
      const item = sub.items.data[0];
      const supported = sub.items.has_more === false && sub.items.data.length === 1 && item
        && sub.metadata.planId === i.terms.planId && sub.metadata.billingInterval === i.terms.interval && item.price.id === i.terms.priceId
        && item.quantity === i.terms.seatQuantity && (!bound || item.quantity === bound.seatQuantity)
        && item.price.recurring && item.price.unit_amount !== null && matchNewTestTerms({ planId: i.terms.planId, interval: i.terms.interval,
          seatQuantity: item.quantity!, configuredPriceId: i.terms.priceId, price: { ...item.price, unit_amount: item.price.unit_amount, recurring: item.price.recurring } }).kind === "supported_terms";
      if (!supported) {
        if (!bound) fail("signed_terms_mismatch");
        const finalSub = await read(timeout => stripe.subscriptions.retrieve(subscriptionId, {}, stripeDeadlineOptions(timeout)));
        if (JSON.stringify(sub) !== JSON.stringify(finalSub)) fail("collection_snapshot_changed");
        await readAccount();
        return { kind: "unsupported_bound_terms" as const, binding: bound, signedTriggerEventId: event.id };
      }
      const observation = lifecycleObservation(sub.status, item.current_period_end, sub.cancel_at_period_end);
      const p = await read(timeout => stripe.prices.retrieve(i.terms.priceId, { expand: ["product"] }, stripeDeadlineOptions(timeout)));
      if (configuredPrices[`${i.terms.planId}:${i.terms.interval}`] !== p.id || typeof p.product === "string" || p.product.deleted || !p.product.active || p.product.livemode !== false || !p.recurring || p.unit_amount === null || matchNewTestTerms({ planId: i.terms.planId, interval: i.terms.interval, seatQuantity: item.quantity!, configuredPriceId: i.terms.priceId, price: { ...p, unit_amount: p.unit_amount, recurring: p.recurring } }).kind !== "supported_terms") fail("signed_terms_mismatch");
      if ((typeof item.price.product === "string" ? item.price.product : item.price.product.id) !== p.product.id) fail("signed_terms_mismatch");
      const identity = paidIdentity({ livemode: false, organizationId: i.organizationId, originatingIntentId: i.id, runtimeId, accountId: expectedAccountId, sessionId: i.sessionId!, customerId, subscriptionId, planId: i.terms.planId, catalogVersion: NEW_TEST_CATALOG_VERSION, seatQuantity: item.quantity!, status: observation.status, eventToken: event.id }, i);
      const coverage = await retrieveCollectedCoverage(stripe, identity, sub, read);
      if (session && (typeof session.invoice === "string" ? session.invoice : session.invoice?.id) !== coverage.latestInvoiceId) fail("collection_identity_mismatch");
      const finalSub = await read(timeout => stripe.subscriptions.retrieve(subscriptionId, {}, stripeDeadlineOptions(timeout)));
      if (JSON.stringify(sub) !== JSON.stringify(finalSub)) fail("collection_snapshot_changed");
      await readAccount();
      return { providerRequestKey: proof.outboundRequestKey, providerRequestDigest: proof.outboundRequestDigest, eventId: event.id,
        accountId: expectedAccountId, livemode: false, organizationId: i.organizationId, intentId: i.id, catalogVersion: NEW_TEST_CATALOG_VERSION,
        sessionId: i.sessionId!, ...(session ? { sessionStatus: session.status ?? "", paymentStatus: session.payment_status } : {}), customerId, subscriptionId,
        seatQuantity: item.quantity!, price: { ...p, unit_amount: p.unit_amount!, recurring: p.recurring! }, eventType: event.type as import("./lifecycle").SubscriptionObservation["eventType"], ...observation,
        coverage: { ...coverage, eventToken: event.id } };
    },
  };
}
