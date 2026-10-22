import { createHash } from "node:crypto";
import { matchesPublicStripePrice } from "./publicStripePrice";
import { canonicalPublicJson } from "./publicCreditAllocation";
import type { PublicCollectedCoverage } from "./publicSubscriptionAllowance";
import type { PublicSubscriptionBinding, PublicSubscriptionObservation } from "./publicSubscriptionEvidence";

export type PublicBillingScope = Readonly<{ organizationId: string; userId: string }>;
export type PublicBillingIdentity = Readonly<{ accountId: string; livemode: boolean }>;
export type PublicCheckoutInput = Readonly<{ planId: "pro" | "enterprise"; interval: "monthly" | "annual"; email: string; successUrl: string; cancelUrl: string }>;
export type PublicCheckoutIntent = PublicCheckoutInput & PublicBillingIdentity & {
  policy: "axiom_public_anniversary_v1"; id: string; enrollmentId: string; organizationId: string; actorUserId: string;
  paidSeats: number; priceId: string; productId: string; unitAmountCents: number;
  requestJson: string; requestDigest: string; providerKey: string;
  state: "prepared" | "attempted" | "unknown" | "confirmed" | "bound" | "expired";
  sessionId: string | null; sessionUrl: string | null; originalCreateProofDigest: string | null;
  createdAt: string; expiresAt: string | null; revision: number;
};
export type PublicCheckoutContract = {
  organizationId: string; enrollmentId: string; binding: PublicSubscriptionBinding;
  anchor: string; firstCollectionDigest: string; coverage: PublicCollectedCoverage | null;
  status: "active" | "past_due" | "canceled" | "no_plan"; cancelAtPeriodEnd: boolean;
  observedAt: string; revision: number;
};
export interface PublicCheckoutTransaction {
  eligibility(scope: PublicBillingScope): Promise<{ manager: boolean; acceptedSeats: number; legacyBinding: boolean }>;
  intent(id: string): Promise<PublicCheckoutIntent | null>;
  activeIntent(org: string): Promise<PublicCheckoutIntent | null>;
  putIntent(intent: PublicCheckoutIntent, expectedRevision: number | null): Promise<void>;
  contract(org: string): Promise<PublicCheckoutContract | null>;
  fulfill(contract: PublicCheckoutContract, expectedRevision: number | null, eventId: string, eventType: string, initialCollection?: PublicCollectedCoverage): Promise<void>;
  eventSeen(id: string): Promise<boolean>;
}
export interface PublicCheckoutStore { transaction<T>(operation: (tx: PublicCheckoutTransaction) => Promise<T>): Promise<T> }
export type PublicBillingTrigger = { id: string; type: string; objectId: string };
export interface PublicCheckoutProvider {
  identity(): PublicBillingIdentity;
  price(planId: "pro" | "enterprise", interval: "monthly" | "annual"): Promise<unknown>;
  create(request: { json: string; digest: string }, key: string): Promise<{ sessionId: string; url: string; accountId: string; livemode: boolean; requestId: string; statusCode: number; providerKey: string; requestDigest: string; expiresAt: string }>;
  session(id: string): Promise<unknown>;
  observe?(intent: PublicCheckoutIntent, trigger: PublicBillingTrigger): Promise<{ binding: PublicSubscriptionBinding; observation: PublicSubscriptionObservation; initialCollection?: PublicCollectedCoverage | null }>;
}
const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export function publicEnrollmentId(identity: PublicBillingIdentity, org: string): string {
  return "pub_" + hash(["axiom_public_anniversary_v1",identity.accountId,identity.livemode,org]).slice(0,48);
}
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const sameAccount = (a: PublicBillingIdentity, b: PublicBillingIdentity) => a.accountId === b.accountId && a.livemode === b.livemode;
function deny(code: string): never { throw new Error(code); }
function checkoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port; } catch { return false; }
}
function comparePurchase(intent: PublicCheckoutIntent, input: PublicCheckoutInput, seats: number): boolean {
  return intent.planId === input.planId && intent.interval === input.interval && intent.email === input.email && intent.successUrl === input.successUrl && intent.cancelUrl === input.cancelUrl && intent.paidSeats === seats;
}
/** Existing approved recurring-intent design: persist ownership before Stripe,
 * permit one attempt, retain unknown results, and never turn a browser redirect
 * or caller-provided subscription status into paid authority. */
export function createPublicCheckoutService(options: { store: PublicCheckoutStore; provider: PublicCheckoutProvider; configuredPrices: Record<string, string>; now: () => Date; id: () => string }) {
  const { store, provider } = options;
  const initialIdentity = Object.freeze({ ...provider.identity() });
  function identity() {
    const actual = provider.identity();
    if (!/^acct_[A-Za-z0-9_]+$/.test(actual.accountId) || typeof actual.livemode !== "boolean" || !sameAccount(initialIdentity, actual)) deny("billing_identity_changed");
    return initialIdentity;
  }
  async function eligible(tx: PublicCheckoutTransaction, scope: PublicBillingScope) {
    const e = await tx.eligibility(scope);
    if (!e.manager) deny("billing_manager_required");
    if (e.legacyBinding) deny("existing_customer_unchanged");
    if (!Number.isSafeInteger(e.acceptedSeats) || e.acceptedSeats < 1) deny("billing_seats_unavailable");
    return e.acceptedSeats;
  }
  async function reuse(scope: PublicBillingScope, existing: PublicCheckoutIntent) {
    if (!sameAccount(existing, identity()) || existing.state !== "confirmed" || !existing.sessionId || !existing.originalCreateProofDigest) return { kind: "reconciliation_required" as const };
    const observed = record(await provider.session(existing.sessionId));
    const metadata = record(observed.metadata);
    identity();
    if (observed.id===existing.sessionId && observed.livemode===existing.livemode && observed.status==="expired" && observed.subscription==null && observed.payment_status==="unpaid" && metadata.intentId===existing.id && metadata.organizationId===existing.organizationId && metadata.billingPolicy===existing.policy) {
      await store.transaction(async tx=>{
        await eligible(tx,scope);
        const current=await tx.intent(existing.id);
        if(!current||current.state!=="confirmed"||current.revision!==existing.revision||await tx.contract(scope.organizationId))deny("purchase_state_changed");
        await tx.putIntent({...current,state:"expired",revision:current.revision+1},current.revision);
      });
      return {kind:"checkout_expired" as const};
    }
    if (observed.id !== existing.sessionId || observed.livemode !== existing.livemode || observed.status !== "open" || observed.subscription != null
      || observed.payment_status !== "unpaid" || !checkoutUrl(observed.url) || observed.url !== existing.sessionUrl
      || metadata.intentId !== existing.id || metadata.organizationId !== existing.organizationId || metadata.billingPolicy !== existing.policy) return { kind: "reconciliation_required" as const };
    await store.transaction(async tx => {
      const seats = await eligible(tx, scope), current = await tx.intent(existing.id);
      if (!current || current.revision !== existing.revision || current.state !== "confirmed" || current.paidSeats !== seats || await tx.contract(scope.organizationId)) deny("purchase_state_changed");
    });
    return { kind: "checkout_ready" as const, url: observed.url };
  }
  return {
    async checkout(scope: PublicBillingScope, input: PublicCheckoutInput) {
      const account = identity();
      if (!scope.userId || !scope.organizationId || !["pro", "enterprise"].includes(input.planId) || !["monthly", "annual"].includes(input.interval)
        || !input.email || input.email.length > 320) deny("billing_request_invalid");
      const observed = await store.transaction(async tx => ({ seats: await eligible(tx, scope), intent: await tx.activeIntent(scope.organizationId), contract: await tx.contract(scope.organizationId) }));
      if (observed.contract) deny("existing_customer_unchanged");
      if (observed.intent) {
        if (!comparePurchase(observed.intent, input, observed.seats)) deny("unresolved_purchase_exists");
        return reuse(scope, observed.intent);
      }
      const priceId = options.configuredPrices[`${input.planId}:${input.interval}`], price = record(await provider.price(input.planId, input.interval));
      if (!priceId || !matchesPublicStripePrice(price, { planId: input.planId, interval: input.interval, expectedPriceId: priceId, livemode: account.livemode }, true)) deny("public_price_mismatch");
      identity();
      const id = options.id(), enrollmentId = publicEnrollmentId(account, scope.organizationId);
      const meta = { billingPolicy: "axiom_public_anniversary_v1", enrollmentId, intentId: id, organizationId: scope.organizationId, planId: input.planId, billingInterval: input.interval };
      const requestJson = JSON.stringify({ mode: "subscription", payment_method_types: ["card"], line_items: [{ price: priceId, quantity: observed.seats }], customer_email: input.email,
        client_reference_id: scope.organizationId, success_url: input.successUrl, cancel_url: input.cancelUrl, allow_promotion_codes: false, automatic_tax: { enabled: false }, metadata: meta, subscription_data: { metadata: meta } });
      const fresh: PublicCheckoutIntent = { ...input, ...account, policy: "axiom_public_anniversary_v1", id, enrollmentId, organizationId: scope.organizationId, actorUserId: scope.userId,
        paidSeats: observed.seats, priceId, productId: String(record(price.product).id), unitAmountCents: price.unit_amount as number,
        requestJson, requestDigest: hash(requestJson), providerKey: `axiom_public_${id}`, state: "prepared", sessionId: null, sessionUrl: null, originalCreateProofDigest: null, createdAt: options.now().toISOString(), expiresAt: null, revision: 0 };
      const intent = await store.transaction(async tx => {
        const seats = await eligible(tx, scope);
        if (seats !== fresh.paidSeats || await tx.contract(scope.organizationId)) deny("purchase_state_changed");
        const concurrent = await tx.activeIntent(scope.organizationId);
        if (concurrent) { if (!comparePurchase(concurrent, input, seats)) deny("unresolved_purchase_exists"); return concurrent; }
        await tx.putIntent(fresh, null); return fresh;
      });
      if (intent.id !== fresh.id) return reuse(scope, intent);
      const claimed = await store.transaction(async tx => {
        if (await eligible(tx, scope) !== intent.paidSeats) deny("seat_snapshot_changed");
        const current = await tx.intent(intent.id);
        if (!current || current.state !== "prepared" || current.revision !== 0) deny("purchase_state_changed");
        const claimed = { ...current, state: "attempted" as const, revision: 1 };
        await tx.putIntent(claimed, 0); return claimed;
      });
      try {
        const receipt = await provider.create({ json: claimed.requestJson, digest: claimed.requestDigest }, claimed.providerKey);
        if (!sameAccount(receipt, identity()) || !receipt.sessionId || !checkoutUrl(receipt.url) || !receipt.requestId || receipt.statusCode < 200 || receipt.statusCode >= 300
          || receipt.providerKey !== claimed.providerKey || receipt.requestDigest !== claimed.requestDigest || !Number.isFinite(Date.parse(receipt.expiresAt))) deny("checkout_receipt_invalid");
        const proof = hash({ intentId: claimed.id, requestDigest: claimed.requestDigest, providerKey: claimed.providerKey, accountId: claimed.accountId, livemode: claimed.livemode, sessionId: receipt.sessionId, requestId: receipt.requestId, statusCode: receipt.statusCode });
        await store.transaction(async tx => {
          const current = await tx.intent(claimed.id);
          if (!current || current.revision !== claimed.revision || current.state !== "attempted" || current.requestDigest !== claimed.requestDigest) deny("purchase_state_changed");
          await tx.putIntent({ ...current, state: "confirmed", sessionId: receipt.sessionId, sessionUrl: receipt.url, expiresAt: receipt.expiresAt, originalCreateProofDigest: proof, revision: current.revision + 1 }, current.revision);
        });
        await store.transaction(async tx => {
          if (await eligible(tx, scope) !== claimed.paidSeats || await tx.contract(scope.organizationId)) deny("purchase_state_changed");
          const current = await tx.intent(claimed.id);
          if (!current || current.state !== "confirmed" || current.originalCreateProofDigest !== proof) deny("purchase_state_changed");
        });
        return { kind: "checkout_ready" as const, url: receipt.url };
      } catch {
        try { await store.transaction(async tx => { const current = await tx.intent(claimed.id); if (current?.state === "attempted") await tx.putIntent({ ...current, state: "unknown", revision: current.revision + 1 }, current.revision); }); } catch { /* durable attempted state remains conservative */ }
        return { kind: "reconciliation_required" as const };
      }
    },
    async reconcile(intentId: string, trigger: PublicBillingTrigger) {
      identity();
      const captured = await store.transaction(async tx => {
        const intent = await tx.intent(intentId);
        if (!intent || !sameAccount(intent, initialIdentity) || !["confirmed", "bound"].includes(intent.state) || !intent.originalCreateProofDigest) deny("checkout_provenance_unavailable");
        return { intent, contract: await tx.contract(intent.organizationId), replay: await tx.eventSeen(trigger.id) };
      });
      if (captured.replay) return "replay" as const;
      if (!provider.observe) deny("subscription_observer_unavailable");
      const { binding, observation, initialCollection } = await provider.observe(captured.intent, trigger); identity();
      const i = captured.intent;
      if (!sameAccount(binding, i) || binding.intentId !== i.id || binding.organizationId !== i.organizationId || binding.enrollmentId !== i.enrollmentId || binding.sessionId !== i.sessionId
        || binding.priceId !== i.priceId || binding.productId !== i.productId || binding.planId !== i.planId || binding.interval !== i.interval || binding.paidSeats !== i.paidSeats || binding.unitAmountCents !== i.unitAmountCents || binding.originalCreateProofDigest !== i.originalCreateProofDigest) deny("public_subscription_binding_mismatch");
      if (captured.contract && canonicalPublicJson(captured.contract.binding) !== canonicalPublicJson(binding)) deny("public_subscription_binding_mismatch");
      if (!captured.contract && observation.kind !== "collected") return "awaiting_collection" as const;
      if (!captured.contract && (!initialCollection || observation.kind!=="collected" || initialCollection.serviceStart!==observation.anchor || initialCollection.originalCreateProofDigest!==i.originalCreateProofDigest || initialCollection.organizationId!==i.organizationId || initialCollection.contractId!==binding.contractId || initialCollection.accountId!==binding.accountId || initialCollection.livemode!==binding.livemode)) deny("original_collection_unverified");
      const anchor = captured.contract?.anchor ?? (observation.kind === "collected" ? observation.anchor : "");
      if (observation.kind === "collected" && observation.anchor !== anchor) deny("subscription_anchor_changed");
      const next: PublicCheckoutContract = { organizationId: i.organizationId, enrollmentId: i.enrollmentId, binding,
        anchor, firstCollectionDigest: captured.contract?.firstCollectionDigest ?? initialCollection!.evidenceDigest,
        coverage: observation.kind === "collected" ? observation.coverage : null, status: observation.status,
        cancelAtPeriodEnd: observation.kind === "collected" && observation.cancelAtPeriodEnd,
        observedAt: options.now().toISOString(), revision: (captured.contract?.revision ?? -1) + 1 };
      return store.transaction(async tx => {
        if (await tx.eventSeen(trigger.id)) return "replay" as const;
        const currentIntent = await tx.intent(i.id), current = await tx.contract(i.organizationId);
        if (!currentIntent || currentIntent.revision !== i.revision || (current?.revision ?? null) !== (captured.contract?.revision ?? null)) deny("subscription_snapshot_changed");
        await tx.fulfill(next, captured.contract?.revision ?? null, trigger.id, trigger.type, captured.contract ? undefined : initialCollection!);
        if (currentIntent.state !== "bound") await tx.putIntent({ ...currentIntent, state: "bound", revision: currentIntent.revision + 1 }, currentIntent.revision);
        return "applied" as const;
      });
    },
  };
}
