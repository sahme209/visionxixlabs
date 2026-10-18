import { ANNIVERSARY_POLICY_V2, resolveAllowanceWindowV2 } from "./anniversaryWindow";
import { originalCreateProofDigest, paidBasisForOriginalCollection, type VerifiedEnrollmentV2 } from "./fixtureAllocation";
import { paidIdentity, paidAccess, validateEvidence, validateObservation, type CoverageObservation, type PaidInvoiceEvidence } from "./paidCoverage";
import { matchNewTestTerms, NEW_TEST_CATALOG_VERSION, decideRecurringIntentRecovery, type FrozenRecurringIntent, type NewTestTerms } from "../newTestSubscriptionContract";
import { hasOriginalCreateProof, isLifecycleEventType, isCollectionEventType, type SubscriptionObservation } from "./lifecycle";
export type Scope = { organizationId: string; userId: string };
export type OriginalCreateProof = { runtimeId: string; accountId: string; sessionId: string; outboundRequestKey: string; outboundRequestDigest: string; requestId: string; statusCode: number; observedIdempotencyKey?: string; observedAccountId?: string; apiVersion?: string };
export type Intent = FrozenRecurringIntent & { allowanceV2?: { policy: "axiom_test_anniversary_v2"; enrollmentDigest: string }; originalCreateProof?: OriginalCreateProof; livemode: false; id: string; terms: NewTestTerms; email: string; runtimeId: string; accountId: string; sessionId: string | null; customerId: string | null; subscriptionId: string | null; revision: number };
export type Contract = { livemode: false; planId: "pro" | "enterprise"; organizationId: string; originatingIntentId: string; catalogVersion: string; runtimeId: string; accountId: string; sessionId: string; customerId: string; subscriptionId: string; eventToken: string; status: string; seatQuantity: number };
export interface Transaction {
  currentTime(): Promise<Date>;
  allowance?(org: string): Promise<VerifiedEnrollmentV2 | null>;
  eligible(scope: Scope): Promise<boolean>;
  acceptedSeats(org: string): Promise<number>;
  intent(id: string): Promise<Intent | null>;
  activeIntent(org: string): Promise<Intent | null>;
  insertIntent(intent: Intent): Promise<void>;
  saveIntent(intent: Intent, expectedRevision: number): Promise<void>;
  contract(org: string): Promise<Contract | null>;
  coverage(org: string): Promise<{ observation: CoverageObservation; originalEvidence: PaidInvoiceEvidence; revision: number } | null>;
  invalidateCoverage(contract: Contract, signedTriggerEventId: string, reason?: "unsupported_terms" | "replay_unavailable"): Promise<void>;
  legacyBinding(org: string): Promise<boolean>;
  eventExists(id: string): Promise<boolean>;
  bind(contract: Contract, eventId: string, observation: SubscriptionObservation, coverage: CoverageObservation): Promise<void>;
  creditEvidence(org: string, month: string, now: Date): Promise<{ usedCents: number; heldCents: number; paidTopUpsCents: number }>;
}
export interface Store { runtimeId: string; transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> }
export type UnsupportedBoundTerms = { kind: "unsupported_bound_terms"; binding: Contract; signedTriggerEventId: string };
export type VerifiedProviderSnapshot = {
    kind?: "verified_snapshot";
    providerRequestKey: string; providerRequestDigest: string; eventId: string; accountId: string; livemode: boolean; organizationId: string; intentId: string;
    catalogVersion: string; sessionId: string; sessionStatus?: string; paymentStatus?: string;
    eventType?: SubscriptionObservation["eventType"]; currentPeriodEndsAt?: string | null; cancelAtPeriodEnd?: boolean;
    coverage: CoverageObservation;
    customerId: string; subscriptionId: string; status: string; seatQuantity: number;
    price: Parameters<typeof matchNewTestTerms>[0]["price"];
};
export interface ProviderBoundary {
  /** Constructed only by isolated trusted IO, never from caller metadata. */
  mode(): { livemode: false; accountId: string };
  price(planId: "pro" | "enterprise", interval: "monthly" | "annual"): Promise<Parameters<typeof matchNewTestTerms>[0]["price"]>;
  create(request: string, key: string, scope?: Scope): Promise<{ id: string; url: string; accountId: string; livemode: boolean; originalCreateProof?: OriginalCreateProof }>;
  verifyAndRetrieve(rawBody: string, signature: string, organizationId?: string): Promise<VerifiedProviderSnapshot | UnsupportedBoundTerms>;
}
function deny(code: string): never { throw new Error(code); }
const sameBinding = (a: Contract | null, b: Contract | null) => a === null || b === null ? a === b : a.customerId === b.customerId && a.subscriptionId === b.subscriptionId && a.eventToken === b.eventToken && a.status === b.status && a.seatQuantity === b.seatQuantity;
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
/** Internal isolated TEST service. No public factory, route, live adapter or
 * operational grant. A Store must independently enforce dedicated fixture
 * identity; catalog/mode JSON is never an isolation or authorization proof. */
export function createNewTestSubscriptionService(options: {
  store: Store; provider: ProviderBoundary; configuredPrices: Record<string, string>;
  now: () => number; id: () => string; digest: (text: string) => string;
}) {
  const { store, provider } = options;
  function mode() { const m = provider.mode(); if (m.livemode !== false || !m.accountId || !store.runtimeId) deny("test_runtime_unavailable"); return m; }
  async function manager(tx: Transaction, scope: Scope) { if (!await tx.eligible(scope)) deny("test_manager_required"); }
  return {
    async prepare(scope: Scope, input: { clientIntentKey: string; planId: "pro" | "enterprise"; interval: "monthly" | "annual"; seatQuantity: number; email: string; successUrl: string; cancelUrl: string }) {
      const account = mode();
      if (!/^[A-Za-z0-9_-]{16,200}$/.test(input.clientIntentKey)) deny("intent_key_invalid");
      const existing = await store.transaction(async tx => { await manager(tx, scope); return { intent: await tx.activeIntent(scope.organizationId), seats: await tx.acceptedSeats(scope.organizationId), allowance: await tx.allowance?.(scope.organizationId) ?? null }; }); // no unauthorized provider read
      if (existing.seats !== input.seatQuantity || existing.seats < 1) deny("seat_snapshot_changed");
      const intentId = existing.intent?.clientIntentKey === input.clientIntentKey ? existing.intent.id : options.id();
      const snapshot = await provider.price(input.planId, input.interval);
      const matched = matchNewTestTerms({ ...input, configuredPriceId: options.configuredPrices[`${input.planId}:${input.interval}`] ?? "", price: snapshot });
      if (matched.kind !== "supported_terms") deny("test_price_mismatch");
      if (mode().accountId !== account.accountId) deny("test_runtime_changed");
      const terms = matched.terms;
      const allowanceV2 = existing.allowance ? { policy: ANNIVERSARY_POLICY_V2, enrollmentDigest: existing.allowance.enrollment.digest } : undefined;
      const allowanceMetadata = allowanceV2 ? { allowancePolicy: allowanceV2.policy, allowanceEnrollmentDigest: allowanceV2.enrollmentDigest } : {};
      const request = JSON.stringify({ mode: "subscription", line_items: [{ price: terms.priceId, quantity: terms.seatQuantity }], customer_email: input.email,
        success_url: input.successUrl, cancel_url: input.cancelUrl,
        metadata: { organizationId: scope.organizationId, catalogVersion: NEW_TEST_CATALOG_VERSION, intentId, ...allowanceMetadata },
        subscription_data: { metadata: { organizationId: scope.organizationId, catalogVersion: NEW_TEST_CATALOG_VERSION, intentId, planId: input.planId, billingInterval: input.interval, ...allowanceMetadata } } });
      const digest = options.digest(request);
      return store.transaction(async tx => {
        await manager(tx, scope);
        if (await tx.acceptedSeats(scope.organizationId) !== terms.seatQuantity) deny("seat_snapshot_changed");
        if (await tx.legacyBinding(scope.organizationId) || await tx.contract(scope.organizationId)) deny("existing_customer_unchanged");
        const enrollment = await tx.allowance?.(scope.organizationId) ?? null;
        if ((enrollment?.enrollment.digest ?? null) !== (existing.allowance?.enrollment.digest ?? null) || (enrollment?.revision ?? null) !== (existing.allowance?.revision ?? null)) deny("allowance_snapshot_changed");
        const active = await tx.activeIntent(scope.organizationId);
        if (active) {
          if (active.clientIntentKey !== input.clientIntentKey || active.requestDigest !== digest) deny("unresolved_purchase_exists");
          return active;
        }
        const now = options.now();
        const intent: Intent = { ...(allowanceV2 ? { allowanceV2 } : {}), livemode: false, id: intentId, organizationId: scope.organizationId, clientIntentKey: input.clientIntentKey, requestDigest: digest,
          providerIdempotencyKey: options.id(), canonicalRequest: request, createdAtMs: now, retryNotAfterMs: now + 23 * 3600000,
          state: "prepared", terms, email: input.email, runtimeId: store.runtimeId, accountId: account.accountId, sessionId: null, customerId: null, subscriptionId: null, revision: 0 };
        await tx.insertIntent(intent); return intent;
      });
    },
    async attempt(scope: Scope, intentId: string) {
      const account = mode();
      const claimed = await store.transaction(async tx => {
        await manager(tx, scope);
        const intent = await tx.intent(intentId);
        if (!intent || intent.organizationId !== scope.organizationId || intent.livemode !== false || intent.runtimeId !== store.runtimeId || intent.accountId !== account.accountId) deny("intent_unavailable");
        const decision = decideRecurringIntentRecovery(intent, { ...scope, clientIntentKey: intent.clientIntentKey, requestDigest: intent.requestDigest, nowMs: options.now() });
        if (decision !== "initial_claim_required") deny(decision === "observe_existing" ? "observe_existing" : "reconciliation_required");
        // Uncertain attempts never auto retry, even inside provider retention.
        await tx.saveIntent({ ...intent, state: "attempted", revision: intent.revision + 1 }, intent.revision);
        return intent;
      });
      try {
        const session = await provider.create(claimed.canonicalRequest!, claimed.providerIdempotencyKey, scope);
        if (mode().accountId !== claimed.accountId || session.accountId !== claimed.accountId || session.livemode !== false) deny("test_runtime_changed");
        const proof = session.originalCreateProof;
        if (proof && (proof.runtimeId !== claimed.runtimeId || proof.accountId !== claimed.accountId || proof.sessionId !== session.id
          || proof.outboundRequestKey !== claimed.providerIdempotencyKey || proof.outboundRequestDigest !== claimed.requestDigest
          || (typeof proof.requestId !== "string" || !proof.requestId.trim()) || !Number.isInteger(proof.statusCode) || proof.statusCode < 200 || proof.statusCode >= 300
          || (proof.observedIdempotencyKey !== undefined && proof.observedIdempotencyKey !== claimed.providerIdempotencyKey)
          || (proof.observedAccountId !== undefined && proof.observedAccountId !== claimed.accountId))) deny("original_create_proof_mismatch");
        if (!session.id || !session.url.startsWith("https://checkout.stripe.com/")) deny("provider_response_invalid");
        await store.transaction(async tx => {
          const current = await tx.intent(claimed.id);
          if (!current || current.state !== "attempted" || current.revision !== claimed.revision + 1 || current.runtimeId !== claimed.runtimeId || current.accountId !== claimed.accountId || current.organizationId !== claimed.organizationId || current.canonicalRequest !== claimed.canonicalRequest || current.requestDigest !== claimed.requestDigest || current.providerIdempotencyKey !== claimed.providerIdempotencyKey || current.sessionId !== null) deny("attempt_state_changed");
          await tx.saveIntent({ ...current, ...(proof ? { originalCreateProof: proof } : {}), sessionId: session.id, state: "session_confirmed", revision: current.revision + 1 }, current.revision);
        });
        // Receipt is durable even when local authority changed during IO.
        await store.transaction(async tx => {
          await manager(tx, scope);
          if (await tx.acceptedSeats(scope.organizationId) !== claimed.terms.seatQuantity) deny("seat_snapshot_changed");
          const current = await tx.intent(claimed.id);
          if (!current || current.sessionId !== session.id || current.organizationId !== scope.organizationId || current.requestDigest !== claimed.requestDigest || current.accountId !== claimed.accountId || current.runtimeId !== claimed.runtimeId || !["session_confirmed", "bound"].includes(current.state)) deny("attempt_state_changed");
          const contract = await tx.contract(scope.organizationId);
          const ownBound = current.state === "bound" && contract && contract.originatingIntentId === current.id
            && contract.organizationId === current.organizationId && contract.runtimeId === current.runtimeId && contract.accountId === current.accountId
            && contract.catalogVersion === current.terms.catalogVersion && contract.planId === current.terms.planId && contract.livemode === false
            && contract.sessionId === current.sessionId && contract.customerId === current.customerId && contract.subscriptionId === current.subscriptionId;
          if ((contract && !ownBound) || (await tx.legacyBinding(scope.organizationId) && !ownBound)) deny("existing_customer_unchanged");
        });
        return { kind: "checkout_ready" as const, url: session.url };
      } catch {
        // May include provider-success/local-commit-unknown; retain all evidence.
        // Do not overwrite a late event's already-bound state.
        try { await store.transaction(async tx => { const current = await tx.intent(claimed.id); if (current?.state === "attempted") await tx.saveIntent({ ...current, state: "unknown", revision: current.revision + 1 }, current.revision); }); } catch { /* original durable attempted hold remains */ }
        return { kind: "reconciliation_required" as const };
      }
    },
    async reconcile(rawBody: string, signature: string, organizationId: string) {
      const account = mode();
      const captured = await store.transaction(async tx => ({ contract: await tx.contract(organizationId), coverageRevision: (await tx.coverage(organizationId))?.revision ?? null, allowance: await tx.allowance?.(organizationId) ?? null }));
      const before = captured.contract;
      async function currentAllowance(tx: Transaction) {
        const state = await tx.allowance?.(organizationId) ?? null;
        if ((state?.enrollment.digest ?? null) !== (captured.allowance?.enrollment.digest ?? null) || (state?.revision ?? null) !== (captured.allowance?.revision ?? null)) deny("allowance_snapshot_changed");
        return state;
      }
      const observed = await provider.verifyAndRetrieve(rawBody, signature, organizationId);
      if (observed.kind === "unsupported_bound_terms") {
        if (mode().accountId !== account.accountId || !before || !observed.signedTriggerEventId || !sameBinding(observed.binding, before)
          || observed.binding.organizationId !== organizationId || observed.binding.runtimeId !== store.runtimeId || observed.binding.accountId !== account.accountId
          || observed.binding.originatingIntentId !== before.originatingIntentId || observed.binding.sessionId !== before.sessionId || observed.binding.catalogVersion !== NEW_TEST_CATALOG_VERSION || observed.binding.planId !== before.planId || observed.binding.livemode !== false) deny("signed_binding_mismatch");
        return store.transaction(async tx => {
          await currentAllowance(tx);
          const current = await tx.contract(organizationId);
          if (!current || !sameBinding(current, before)) deny("subscription_snapshot_changed");
          const intent = await tx.intent(current.originatingIntentId);
          if (!intent || !hasOriginalCreateProof(intent) || intent.state !== "bound" || intent.organizationId !== organizationId || intent.runtimeId !== store.runtimeId || intent.accountId !== account.accountId
            || intent.customerId !== current.customerId || intent.subscriptionId !== current.subscriptionId || intent.sessionId !== current.sessionId || intent.terms.planId !== current.planId || intent.terms.seatQuantity !== current.seatQuantity) deny("attempt_provenance_unavailable");
          const prior = await tx.coverage(organizationId); if (!prior) deny("paid_coverage_unavailable");
          if (prior.revision !== captured.coverageRevision) deny("coverage_snapshot_changed");
          validateEvidence(paidIdentity(current, intent), prior.originalEvidence);
          await tx.invalidateCoverage(current, observed.signedTriggerEventId);
          return "unavailable" as const;
        });
      }
      const eventType = observed.eventType ?? "checkout.session.completed";
      if (eventType !== "checkout.session.completed" && !isLifecycleEventType(eventType) && !isCollectionEventType(eventType)) deny("signed_binding_mismatch");
      const lifecycle = eventType !== "checkout.session.completed";
      if (!observed.eventId || observed.accountId !== account.accountId || observed.livemode !== false || observed.organizationId !== organizationId
        || observed.catalogVersion !== NEW_TEST_CATALOG_VERSION || !observed.customerId || !observed.subscriptionId || !observed.sessionId
        || (!lifecycle && (eventType !== "checkout.session.completed" || observed.sessionStatus !== "complete" || observed.paymentStatus !== "paid"))) deny("signed_binding_mismatch");
      if (lifecycle && (!before || typeof observed.cancelAtPeriodEnd !== "boolean" || typeof observed.currentPeriodEndsAt !== "string"
        || !Number.isFinite(new Date(observed.currentPeriodEndsAt).getTime()))) deny("subscription_snapshot_invalid");
      const currentMode = mode();
      if (currentMode.accountId !== account.accountId) deny("test_runtime_changed");
      return store.transaction(async tx => {
        const allowance = await currentAllowance(tx);
        const historicalReceipt = await tx.eventExists(observed.eventId);
        const current = await tx.contract(organizationId);
        if (!sameBinding(current, before)) deny("subscription_snapshot_changed");
        const intent = await tx.intent(observed.intentId);
        if (!intent || intent.organizationId !== organizationId || intent.livemode !== false || intent.runtimeId !== store.runtimeId || intent.accountId !== account.accountId || intent.state === "prepared" || intent.state === "terminal_verified"
          || (intent.sessionId && intent.sessionId !== observed.sessionId)) deny("signed_binding_mismatch");
        if (observed.providerRequestKey !== intent.providerIdempotencyKey || observed.providerRequestDigest !== intent.requestDigest) deny("attempt_provenance_unavailable");
        if (!hasOriginalCreateProof(intent)) deny("attempt_provenance_unavailable");
        if (lifecycle && (!current || intent.state !== "bound"
          || current.sessionId !== intent.sessionId || current.originatingIntentId !== intent.id)) deny("attempt_provenance_unavailable");
        if (current && (current.originatingIntentId !== intent.id || current.customerId !== observed.customerId || current.subscriptionId !== observed.subscriptionId)) deny("replacement_requires_review");
        if (!current && await tx.legacyBinding(organizationId)) deny("existing_customer_unchanged");
        const matched = matchNewTestTerms({ planId: intent.terms.planId, interval: intent.terms.interval, seatQuantity: observed.seatQuantity, configuredPriceId: intent.terms.priceId, price: observed.price });
        if (matched.kind !== "supported_terms" || (!current && observed.seatQuantity !== intent.terms.seatQuantity)) deny("signed_terms_mismatch");
        // Active subscription state does not independently prove collection for
        // changed quantities. This inactive lane supports unchanged paid terms.
        if (current && (observed.seatQuantity !== current.seatQuantity || observed.seatQuantity !== intent.terms.seatQuantity)) deny("seat_change_requires_review");
        if (!["active", "past_due", "canceled", "trialing", "no_plan"].includes(observed.status)) deny("policy_unresolved");
        const next: Contract = { livemode: false, planId: intent.terms.planId, organizationId, originatingIntentId: intent.id, catalogVersion: NEW_TEST_CATALOG_VERSION, runtimeId: store.runtimeId,
          accountId: account.accountId, sessionId: observed.sessionId, customerId: observed.customerId, subscriptionId: observed.subscriptionId,
          eventToken: observed.eventId, status: observed.status, seatQuantity: observed.seatQuantity };
        const identity = paidIdentity(next, intent);
        validateObservation(identity, observed.eventId, observed.coverage);
        if (observed.currentPeriodEndsAt !== observed.coverage.currentPeriodEnd) deny("subscription_snapshot_invalid");
        const prior = current ? await tx.coverage(organizationId) : null;
        if ((prior?.revision ?? null) !== captured.coverageRevision) deny("coverage_snapshot_changed");
        if (intent.allowanceV2) {
          if (!allowance || intent.allowanceV2.policy !== ANNIVERSARY_POLICY_V2 || allowance.enrollment.digest !== intent.allowanceV2.enrollmentDigest || current && !allowance.paidBasis) deny("allowance_provenance_unavailable");
          if (observed.coverage.collection.kind === "collected") {
            const e = observed.coverage.collection.evidence;
            if (e.version !== 2 || e.enrollmentDigest !== allowance.enrollment.digest || e.originalCreateProofDigest !== originalCreateProofDigest(intent)
              || allowance.paidBasis && e.originalAnchor !== allowance.paidBasis.anchor) deny("allowance_provenance_unavailable");
            if (!current) paidBasisForOriginalCollection(allowance.enrollment, intent, e);
          }
        } else if (allowance || observed.coverage.collection.kind === "collected" && observed.coverage.collection.evidence.version !== 1) deny("allowance_provenance_unavailable");
        if (current) { if (!prior) deny("paid_coverage_unavailable"); validateEvidence(identity, prior.originalEvidence); }
        else if (observed.coverage.collection.kind !== "collected") deny("initial_collection_required");
        if (historicalReceipt) {
          if (!current || !prior) deny("paid_coverage_unavailable");
          let deprivilege = observed.coverage.collection.kind === "unavailable" || observed.status !== current.status
            || observed.coverage.currentPeriodStart !== prior.observation.currentPeriodStart || observed.coverage.currentPeriodEnd !== prior.observation.currentPeriodEnd;
          if (!deprivilege && observed.status === "active") {
            const now = await tx.currentTime();
            try {
              if (allowance?.paidBasis) {
                const collection = observed.coverage.collection;
                const result = resolveAllowanceWindowV2(allowance.paidBasis, collection.kind === "collected" ? { ...collection.evidence, kind: "collected", version: 2, policy: ANNIVERSARY_POLICY_V2, status: observed.status, basisDigest: allowance.paidBasis.digest, evidenceDigest: collection.evidence.digest } : { kind: "unavailable" }, now);
                if (result.kind !== "available") deny("paid_coverage_unavailable");
              } else paidAccess(identity, observed.status, observed.eventId, observed.coverage, true, now);
            }
            catch { deprivilege = true; }
          }
          if (deprivilege) await tx.invalidateCoverage(current, observed.eventId, "replay_unavailable");
          return "replay" as const;
        }
        await tx.bind(next, observed.eventId,
          { eventType, currentPeriodEndsAt: observed.currentPeriodEndsAt ?? null, cancelAtPeriodEnd: observed.cancelAtPeriodEnd ?? false }, observed.coverage);
        await tx.saveIntent({ ...intent, state: "bound", sessionId: observed.sessionId, customerId: observed.customerId, subscriptionId: observed.subscriptionId, revision: intent.revision + 1 }, intent.revision);
        return "applied" as const;
      });
    },
    async previewRemaining(scope: Scope) {
      const account = mode();
      return store.transaction(async tx => {
        await manager(tx, scope);
        const contract = await tx.contract(scope.organizationId);
        if (!contract || contract.catalogVersion !== NEW_TEST_CATALOG_VERSION || contract.livemode !== false || contract.runtimeId !== store.runtimeId || contract.accountId !== account.accountId) deny("new_test_contract_unavailable");
        const intent = await tx.intent(contract.originatingIntentId);
        if (!intent || intent.organizationId !== scope.organizationId || intent.livemode !== false || intent.runtimeId !== store.runtimeId || intent.accountId !== contract.accountId || intent.state !== "bound" || intent.terms.catalogVersion !== NEW_TEST_CATALOG_VERSION || intent.terms.planId !== contract.planId || intent.subscriptionId !== contract.subscriptionId || intent.customerId !== contract.customerId) deny("new_test_contract_unavailable");
        if (!hasOriginalCreateProof(intent) || contract.seatQuantity !== intent.terms.seatQuantity) deny("attempt_provenance_unavailable");
        const coverage = await tx.coverage(scope.organizationId);
        const identity = paidIdentity(contract, intent);
        if (coverage) validateEvidence(identity, coverage.originalEvidence);
        const now = await tx.currentTime();
        const access = paidAccess(identity, contract.status, contract.eventToken, coverage?.observation ?? null, !!coverage, now);
        const month = access.month;
        const evidence = await tx.creditEvidence(scope.organizationId, month, now);
        if (![evidence.usedCents, evidence.heldCents, evidence.paidTopUpsCents].every(integer)) deny("credit_evidence_unavailable");
        const allocation = access.monthlyAICreditsCents;
        const pool = allocation + evidence.paidTopUpsCents;
        if (!integer(pool) || !integer(evidence.usedCents + evidence.heldCents)) deny("credit_evidence_unavailable");
        return { kind: "isolated_test_preview" as const, remainingCents: Math.max(0, pool - evidence.usedCents - evidence.heldCents), month,
          operationalPermit: false as const, invoiceSubmissionEnabled: false as const };
      });
    },
  };
}
