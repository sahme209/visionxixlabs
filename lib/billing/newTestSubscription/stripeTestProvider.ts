import "server-only";
import Stripe from "stripe";
import { denyIsolatedExternalIO } from "../isolatedApplication/runtime";
import { createHash } from "node:crypto";
import { matchNewTestTerms, NEW_TEST_CATALOG_VERSION } from "../newTestSubscriptionContract";
import type { Intent, ProviderBoundary, Store } from "./service";
import { hasOriginalCreateProof, isLifecycleEventType, lifecycleObservation } from "./lifecycle";
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
  const stripe = sdkFactory ? sdkFactory(secretKey) : new Stripe(secretKey, { timeout: 10_000, maxNetworkRetries: 0 });
  function runtime() { denyIsolatedExternalIO(); if (store.runtimeId !== runtimeId) fail("test_runtime_changed"); }
  async function account() { runtime(); const current = await stripe.accounts.retrieve(); runtime(); if (current.id !== expectedAccountId) fail("test_account_mismatch"); }
  function intentValid(i: Intent | null): i is Intent { return !!i && i.runtimeId === runtimeId && i.accountId === expectedAccountId && i.livemode === false && i.terms.catalogVersion === NEW_TEST_CATALOG_VERSION; }
  async function price(plan: "pro" | "enterprise", interval: "monthly" | "annual") {
    await account();
    runtime();
    const id = configuredPrices[`${plan}:${interval}`]; if (!id) fail("test_price_mismatch");
    const p = await stripe.prices.retrieve(id, { expand: ["product"] });
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
      const s = await stripe.checkout.sessions.create(request, { idempotencyKey: key });
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
    async verifyAndRetrieve(raw, signature) {
      runtime();
      if (typeof raw !== "string" || !raw.length || raw.length > 262_144 || Buffer.byteLength(raw, "utf8") > 262_144 || typeof signature !== "string" || !signature.length || signature.length > 4096 || Buffer.byteLength(signature, "utf8") > 4096) fail("provider_input_bounds");
      const event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
      const lifecycle = isLifecycleEventType(event.type);
      if (!event.id || event.livemode !== false || (event.type !== "checkout.session.completed" && !lifecycle) || (event.account && event.account !== expectedAccountId)) fail("signed_binding_mismatch");
      await account();
      const hint = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
      const id = hint.metadata?.intentId; if (!id) fail("attempt_provenance_unavailable");
      const i = await store.transaction(tx => tx.intent(id!));
      const proof = i?.originalCreateProof;
      if (!intentValid(i) || !hasOriginalCreateProof(i) || !proof) fail("attempt_provenance_unavailable");
      if (lifecycle) {
        const bound = await store.transaction(tx => tx.contract(i.organizationId));
        if (!bound || i.state !== "bound" || bound.livemode !== false || bound.runtimeId !== runtimeId || bound.accountId !== expectedAccountId
          || bound.organizationId !== i.organizationId || bound.originatingIntentId !== i.id || bound.catalogVersion !== NEW_TEST_CATALOG_VERSION || bound.planId !== i.terms.planId
          || bound.sessionId !== i.sessionId || bound.customerId !== i.customerId || bound.subscriptionId !== i.subscriptionId
          || hint.id !== bound.subscriptionId || hint.customer !== bound.customerId || hint.livemode !== false
          || hint.metadata?.organizationId !== i.organizationId || hint.metadata?.catalogVersion !== NEW_TEST_CATALOG_VERSION) fail("signed_binding_mismatch");
        runtime();
        const sub = await stripe.subscriptions.retrieve(bound.subscriptionId);
        runtime();
        const item = sub.items.data[0];
        if (sub.id !== bound.subscriptionId || sub.livemode !== false || sub.customer !== bound.customerId || sub.items.has_more !== false || sub.items.data.length !== 1 || !item
          || sub.metadata.intentId !== i.id || sub.metadata.organizationId !== i.organizationId || sub.metadata.catalogVersion !== NEW_TEST_CATALOG_VERSION
          || sub.metadata.planId !== i.terms.planId || sub.metadata.billingInterval !== i.terms.interval || item.price.id !== i.terms.priceId) fail("signed_terms_mismatch");
        if (!item.price.recurring || item.price.unit_amount === null || matchNewTestTerms({ planId: i.terms.planId, interval: i.terms.interval,
          seatQuantity: item.quantity!, configuredPriceId: i.terms.priceId, price: { ...item.price, unit_amount: item.price.unit_amount, recurring: item.price.recurring } }).kind !== "supported_terms") fail("signed_terms_mismatch");
        const observation = lifecycleObservation(sub.status, item.current_period_end, sub.cancel_at_period_end);
        const p = await price(i.terms.planId, i.terms.interval);
        if (matchNewTestTerms({ planId: i.terms.planId, interval: i.terms.interval, seatQuantity: item.quantity!, configuredPriceId: i.terms.priceId, price: p }).kind !== "supported_terms") fail("signed_terms_mismatch");
        await account();
        return { providerRequestKey: proof.outboundRequestKey, providerRequestDigest: proof.outboundRequestDigest, eventId: event.id,
          accountId: expectedAccountId, livemode: false, organizationId: i.organizationId, intentId: i.id, catalogVersion: NEW_TEST_CATALOG_VERSION,
          sessionId: bound.sessionId, customerId: bound.customerId, subscriptionId: bound.subscriptionId,
          seatQuantity: item.quantity!, price: p, eventType: event.type as import("./lifecycle").LifecycleEventType, ...observation };
      }
      if (hint.id !== i.sessionId) fail("attempt_provenance_unavailable");
      runtime();
      const session = await stripe.checkout.sessions.retrieve(i.sessionId!, { expand: ["line_items"] });
      if (session.livemode !== false || session.mode !== "subscription" || session.id !== proof.sessionId || session.metadata?.intentId !== i.id
        || session.metadata?.organizationId !== i.organizationId || session.metadata?.catalogVersion !== NEW_TEST_CATALOG_VERSION
        || typeof session.customer !== "string" || typeof session.subscription !== "string" || !session.line_items || session.line_items.has_more || session.line_items.data.length !== 1) fail("signed_binding_mismatch");
      runtime();
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      runtime();
      const item = sub.items.data[0];
      if (sub.id !== session.subscription || sub.livemode !== false || sub.customer !== session.customer || sub.items.has_more || sub.items.data.length !== 1 || !item
        || sub.metadata.intentId !== i.id || sub.metadata.organizationId !== i.organizationId || sub.metadata.catalogVersion !== NEW_TEST_CATALOG_VERSION
        || item.price.id !== i.terms.priceId || session.line_items.data[0].price?.id !== i.terms.priceId
        || session.line_items.data[0].quantity !== i.terms.seatQuantity || item.quantity !== i.terms.seatQuantity) fail("signed_terms_mismatch");
      const p = await price(i.terms.planId, i.terms.interval);
      await account();
      return { providerRequestKey: proof.outboundRequestKey, providerRequestDigest: proof.outboundRequestDigest, eventId: event.id,
        accountId: expectedAccountId, livemode: false, organizationId: i.organizationId, intentId: i.id, catalogVersion: NEW_TEST_CATALOG_VERSION,
        sessionId: session.id, sessionStatus: session.status ?? "", paymentStatus: session.payment_status, customerId: session.customer as string,
        subscriptionId: session.subscription as string, status: sub.status, seatQuantity: item.quantity!, price: p };
    },
  };
}
