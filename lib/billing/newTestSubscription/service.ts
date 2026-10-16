import { PUBLIC_PLAN_CATALOG } from "../publicPlanCatalog";
import { matchNewTestTerms, NEW_TEST_CATALOG_VERSION, decideRecurringIntentRecovery, type FrozenRecurringIntent, type NewTestTerms } from "../newTestSubscriptionContract";
export type Scope = { organizationId: string; userId: string };
export type Intent = FrozenRecurringIntent & { livemode: false; id: string; terms: NewTestTerms; email: string; runtimeId: string; accountId: string; sessionId: string | null; customerId: string | null; subscriptionId: string | null; revision: number };
export type Contract = { livemode: false; planId: "pro" | "enterprise"; organizationId: string; originatingIntentId: string; catalogVersion: string; runtimeId: string; accountId: string; sessionId: string; customerId: string; subscriptionId: string; eventToken: string; status: string; seatQuantity: number };
export interface Transaction {
  eligible(scope: Scope): Promise<boolean>;
  acceptedSeats(org: string): Promise<number>;
  intent(id: string): Promise<Intent | null>;
  activeIntent(org: string): Promise<Intent | null>;
  insertIntent(intent: Intent): Promise<void>;
  saveIntent(intent: Intent, expectedRevision: number): Promise<void>;
  contract(org: string): Promise<Contract | null>;
  legacyBinding(org: string): Promise<boolean>;
  eventExists(id: string): Promise<boolean>;
  bind(contract: Contract, eventId: string): Promise<void>;
  creditEvidence(org: string, month: string, now: Date): Promise<{ usedCents: number; heldCents: number; paidTopUpsCents: number }>;
}
export interface Store { runtimeId: string; transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> }
export interface ProviderBoundary {
  /** Constructed only by isolated trusted IO, never from caller metadata. */
  mode(): { livemode: false; accountId: string };
  price(planId: "pro" | "enterprise", interval: "monthly" | "annual"): Promise<Parameters<typeof matchNewTestTerms>[0]["price"]>;
  create(request: string, key: string): Promise<{ id: string; url: string; accountId: string; livemode: boolean }>;
  verifyAndRetrieve(rawBody: string, signature: string): Promise<{
    providerRequestKey: string; providerRequestDigest: string; eventId: string; accountId: string; livemode: boolean; organizationId: string; intentId: string;
    catalogVersion: string; sessionId: string; sessionStatus: string; paymentStatus: string;
    customerId: string; subscriptionId: string; status: string; seatQuantity: number;
    price: Parameters<typeof matchNewTestTerms>[0]["price"];
  }>;
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
      const existing = await store.transaction(async tx => { await manager(tx, scope); return { intent: await tx.activeIntent(scope.organizationId), seats: await tx.acceptedSeats(scope.organizationId) }; }); // no unauthorized provider read
      if (existing.seats !== input.seatQuantity || existing.seats < 1) deny("seat_snapshot_changed");
      const intentId = existing.intent?.clientIntentKey === input.clientIntentKey ? existing.intent.id : options.id();
      const snapshot = await provider.price(input.planId, input.interval);
      const matched = matchNewTestTerms({ ...input, configuredPriceId: options.configuredPrices[`${input.planId}:${input.interval}`] ?? "", price: snapshot });
      if (matched.kind !== "supported_terms") deny("test_price_mismatch");
      if (mode().accountId !== account.accountId) deny("test_runtime_changed");
      const terms = matched.terms;
      const request = JSON.stringify({ mode: "subscription", line_items: [{ price: terms.priceId, quantity: terms.seatQuantity }], customer_email: input.email,
        success_url: input.successUrl, cancel_url: input.cancelUrl,
        metadata: { organizationId: scope.organizationId, catalogVersion: NEW_TEST_CATALOG_VERSION, intentId },
        subscription_data: { metadata: { organizationId: scope.organizationId, catalogVersion: NEW_TEST_CATALOG_VERSION, intentId, planId: input.planId, billingInterval: input.interval } } });
      const digest = options.digest(request);
      return store.transaction(async tx => {
        await manager(tx, scope);
        if (await tx.acceptedSeats(scope.organizationId) !== terms.seatQuantity) deny("seat_snapshot_changed");
        if (await tx.legacyBinding(scope.organizationId) || await tx.contract(scope.organizationId)) deny("existing_customer_unchanged");
        const active = await tx.activeIntent(scope.organizationId);
        if (active) {
          if (active.clientIntentKey !== input.clientIntentKey || active.requestDigest !== digest) deny("unresolved_purchase_exists");
          return active;
        }
        const now = options.now();
        const intent: Intent = { livemode: false, id: intentId, organizationId: scope.organizationId, clientIntentKey: input.clientIntentKey, requestDigest: digest,
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
        const session = await provider.create(claimed.canonicalRequest!, claimed.providerIdempotencyKey);
        if (mode().accountId !== claimed.accountId || session.accountId !== claimed.accountId || session.livemode !== false) deny("test_runtime_changed");
        if (!session.id || !session.url.startsWith("https://checkout.stripe.com/")) deny("provider_response_invalid");
        await store.transaction(async tx => {
          const current = await tx.intent(claimed.id);
          if (!current || current.state !== "attempted" || current.revision !== claimed.revision + 1) deny("attempt_state_changed");
          await tx.saveIntent({ ...current, sessionId: session.id, state: "session_confirmed", revision: current.revision + 1 }, current.revision);
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
      const before = await store.transaction(tx => tx.contract(organizationId));
      const observed = await provider.verifyAndRetrieve(rawBody, signature);
      if (!observed.eventId || observed.accountId !== account.accountId || observed.livemode !== false || observed.organizationId !== organizationId
        || observed.catalogVersion !== NEW_TEST_CATALOG_VERSION || !observed.customerId || !observed.subscriptionId || !observed.sessionId
        || observed.sessionStatus !== "complete" || observed.paymentStatus !== "paid") deny("signed_binding_mismatch");
      const currentMode = mode();
      if (currentMode.accountId !== account.accountId) deny("test_runtime_changed");
      return store.transaction(async tx => {
        if (await tx.eventExists(observed.eventId)) return "replay" as const;
        const current = await tx.contract(organizationId);
        if (!sameBinding(current, before)) deny("subscription_snapshot_changed");
        const intent = await tx.intent(observed.intentId);
        if (!intent || intent.organizationId !== organizationId || intent.livemode !== false || intent.runtimeId !== store.runtimeId || intent.accountId !== account.accountId || intent.state === "prepared" || intent.state === "terminal_verified"
          || (intent.sessionId && intent.sessionId !== observed.sessionId)) deny("signed_binding_mismatch");
        if (observed.providerRequestKey !== intent.providerIdempotencyKey || observed.providerRequestDigest !== intent.requestDigest) deny("attempt_provenance_unavailable");
        if (current && (current.originatingIntentId !== intent.id || current.customerId !== observed.customerId || current.subscriptionId !== observed.subscriptionId)) deny("replacement_requires_review");
        if (!current && await tx.legacyBinding(organizationId)) deny("existing_customer_unchanged");
        const matched = matchNewTestTerms({ planId: intent.terms.planId, interval: intent.terms.interval, seatQuantity: observed.seatQuantity, configuredPriceId: intent.terms.priceId, price: observed.price });
        if (matched.kind !== "supported_terms" || (!current && observed.seatQuantity !== intent.terms.seatQuantity)) deny("signed_terms_mismatch");
        if (!["active", "past_due", "canceled", "trialing", "no_plan"].includes(observed.status)) deny("policy_unresolved");
        await tx.bind({ livemode: false, planId: intent.terms.planId, organizationId, originatingIntentId: intent.id, catalogVersion: NEW_TEST_CATALOG_VERSION, runtimeId: store.runtimeId,
          accountId: account.accountId, sessionId: observed.sessionId, customerId: observed.customerId, subscriptionId: observed.subscriptionId,
          eventToken: observed.eventId, status: observed.status, seatQuantity: observed.seatQuantity }, observed.eventId);
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
        const month = new Date(options.now()).toISOString().slice(0, 7);
        const evidence = await tx.creditEvidence(scope.organizationId, month, new Date(options.now()));
        if (![evidence.usedCents, evidence.heldCents, evidence.paidTopUpsCents].every(integer)) deny("credit_evidence_unavailable");
        const plan = contract.status === "active" ? intent.terms.planId : "free";
        const catalog = PUBLIC_PLAN_CATALOG.find(p => p.id === plan);
        if (!catalog) deny("policy_unresolved");
        const allocation = catalog.monthlyAiCreditCents * (catalog.aiCreditBasis === "paid_seat" ? contract.seatQuantity : 1);
        const pool = allocation + evidence.paidTopUpsCents;
        if (!integer(pool) || !integer(evidence.usedCents + evidence.heldCents)) deny("credit_evidence_unavailable");
        return { kind: "isolated_test_preview" as const, remainingCents: Math.max(0, pool - evidence.usedCents - evidence.heldCents), month,
          operationalPermit: false as const, invoiceSubmissionEnabled: false as const };
      });
    },
  };
}
