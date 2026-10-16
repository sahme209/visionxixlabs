# Billing customer-journey acceptance

Reviewed 2026-10-15. This document separates implemented contracts from actual
provider acceptance. No production configuration, data, or live billing is
changed or authorized by this work.

## Evidence and gaps

| Customer step | Existing implementation/evidence | Status and next action |
| --- | --- | --- |
| Owner selects subscription | `app/api/billing/checkout-session/route.ts`, its tests; `stripeHelper.ts` | Implemented, provider acceptance unverified. Requires authenticated owner, same origin, accepted-member seat count, valid public plan and interval, billing opt-in and configured test price. |
| Checkout establishes entitlement | `app/api/billing/stripe-webhook/route.ts`, route tests; `tenantBillingStore.ts` | Checkout completion alone intentionally does not grant subscription entitlement. Signed subscription lifecycle events supply authority, with tenant/customer/subscription binding. Actual signed delivery, renewal and out-of-order lifecycle acceptance remain unverified. |
| Paid credit fulfillment | `aiCreditFulfillment.ts`, `aiCreditFulfillment.test.ts` | Exact paid session amount/currency/catalog/purchase/session checked; unique Stripe event ledger participates in transaction. Actual test checkout/replay unverified. |
| AI execution and authoritative receipt | `reconcileGatewayUsage.ts`, its tests; `aiBillingComposedJourney.test.ts` | Simulated receipt flows into settlement with exact generation identity. Actual Gateway receipt ingestion and SQL transaction acceptance unverified. |
| 1.5x customer amount and caps | `aiBillingMargin.ts`, reconciliation, `settleAIUsageToStripe.ts` | Composed regression carries 2 provider cents to 3 customer cents. Approved generation reservation can reduce customer debit; monthly invoice budget can block submission. Integer-cent provider rounding occurs before margin. No new pricing policy introduced. |
| Test invoice item and retry | `settleAIUsageToStripe.ts`, composed and worker tests | Simulated invoice item gets exact tenant/event/amount/idempotency key; repeated composed run creates no second item or reservation. Actual Stripe response/unknown-outcome reconciliation unverified. |
| Final invoice and collection | Current worker creates pending invoice items only; see `BILLING_RECONCILIATION.md` | Automated finalization/payment lifecycle is outside current implementation. An item is not a paid invoice. Need separately reviewed invoice/collection design before claiming customer charging complete. |
| Refund and replay | `aiCreditFulfillment.ts`, webhook route tests, fulfillment tests | Credit purchase cumulative refunds reverse credits proportionally. Atomic nondecreasing refund/reversed-credit predicates now prevent delayed smaller events from restoring credits. This does not implement usage-invoice refunds or credit notes. Actual Stripe refund delivery/replay unverified. |
| Deployment quota and customer entitlement | `effectiveEntitlements.ts`, `deploymentQuota.ts`, quota tests | Existing kernels tested independently; no complete subscribed-customer → cloud execution → invoice journey accepted yet. |

## Composed regression boundary

`aiBillingComposedJourney.test.ts` invokes both real reconciliation and invoice
settlement functions over the same in-memory ledger, with mocked Gateway and
Stripe SDK responses. It verifies downstream amount propagation, replay,
identity mismatch and generation/monthly ceilings. It deliberately does not
simulate SQL query behavior or transaction rollback and does not stand in for
subscription/browser/Stripe/Gateway end-to-end acceptance. Existing PostgreSQL
fixture tests and transaction-specific tests provide separate evidence.

`aiCreditFulfillment.test.ts` additionally delivers full, delayed partial and
zero cumulative refunds in that order. The final row stays fully refunded;
all distinct events can be recorded while stale financial updates are no-ops.
The conditional update compares persisted counters, protecting concurrent
handlers that observed older snapshots as well as sequential delivery.

## Isolated test-mode execution packet (not authorized by this document)

Before provider-backed acceptance, identify one isolated non-production
application deployment and test database with the required schema. Confirm no
production customer records, live webhook endpoint, deployment worker or
production integrations are reachable. Select a synthetic owner/member tenant
and a bounded test budget. Confirm current commercial entitlement policy and
public-plan/legacy-tier mapping; do not silently resolve governance conflicts.

An operator must securely bind test-only Stripe secret and webhook signing
secret, matching test price IDs, approved self-service enablement and the
separate AI settlement test opt-in. Never paste values into chat/logs. Settlement
requires mode `test` and an `sk_test_` key; no live key is accepted. A test-only
Gateway receipt source or explicitly budgeted isolated Gateway request must be
selected separately; real Gateway calls can still incur provider cost.

Obtain explicit approval for isolated configuration/provisioning and bounded
external test actions before performing them. Record application commit,
synthetic tenant reference, Stripe test account/mode attestation, test price
mapping, webhook destination and event evidence privately. Public reports
contain only sanitized pass/fail and evidence references.

Execute and retain evidence for:

1. Owner checkout with accepted-member seat quantity; member denied; checkout
   completion grants no premature entitlement.
2. Valid signed subscription activation updates only intended tenant; replay,
   invalid signature and cross-tenant identifiers cannot grant access.
3. Test credit checkout, exact fulfillment, repeated event and mismatched amount
   tests; no duplicate credit grant.
4. Approved AI request, captured exact generation receipt, integer-cent cost and
   margin reconciliation; verify hold release/settlement and remaining budget.
5. Test invoice-item creation with exact amount/customer/idempotency metadata;
   repeated worker and uncertain-response reconciliation; spending cap blocks.
6. If explicitly approved, manually controlled **test** invoice finalization and
   test payment inspection. Record this as external test action, not automated
   product functionality. Do not enable production collection.
7. Credit-purchase partial/full refund, delayed smaller cumulative refund and
   replay: revoked credits never increase. Usage-invoice refunds require their
   own reviewed policy/implementation and remain a separate gap.
8. Cancellation, past-due and plan/seat changes through signed lifecycle events;
   confirm desktop/cloud entitlement gates respond correctly.

Stop on unexpected live mode, target ambiguity, amount/tenant mismatch,
insufficient budget or unrecognized external outcome. Retain ledger holds for
reconciliation rather than deleting evidence. Cleanup of isolated resources or
refunds still follows the separately approved test packet.


Current subscription follow-up: `SUBSCRIPTION_AUTHORITATIVE_RECONCILIATION.md`
implements current-provider-state retrieval with an equality-only binding/token
fence for distinct delayed events. Canonical configured seat-price evidence is
required; failures remain unconsumed. Replacement needs explicit authority rather
than silently rebinding a tenant. Local composed regressions are not actual Stripe
provider delivery, collection, invoice refunds or commercial-policy acceptance.

## Full commercial lifecycle source audit · 2026-10-16

Audit base: main PR #147, `cca52dfb`. This is source inspection and existing
regression evidence, not successful Stripe customer acceptance. The separate
financial-evidence availability patch hides unverifiable financial reads; it
does not resolve the commercial policy inconsistencies below. Support-payment
checkout/webhooks are outside this audit's change scope and remain untouched.

| Boundary | Implemented evidence | Disconnected or unverified |
| --- | --- | --- |
| Pricing | `publicPlanCatalog.ts`: Free/Pro/Enterprise; monthly $0/$29/$79 per seat; annual equivalents $0/$23.20/$63.20; public UI consumes this catalog | The file calls this proposed. `planRegistry.ts` declares Starter/Growth/Business/Enterprise $199/$799/$2,499/custom. `PRICING_ENTITLEMENTS_REFACTOR.md` instead declares `User.plan` canonical. Master mission section12 names Starter/Growth/Scale. No single approved cross-product authority is established. |
| Subscription Checkout | Canonical `/api/billing/checkout-session`, legacy alias, same-origin/current owner-admin and activation/mode gates; accepted member count controls licensed quantity; plan/interval metadata reaches subscription | No durable recurring purchase intent/provider key. A lost response and fresh retry can create duplicate sessions/subscriptions. It does not implement subscription changes or authorized replacement. |
| Webhook | Signature verification; current exact subscription retrieval; tenant/customer/mode/price/quantity checks; durable event consumption plus final binding/token equality fence | Real provider delivery has not been verified. Replacement is deliberately denied. A configured price ID/shape does not independently prove the advertised amount; approved test provisioning must verify it. |
| Renew/cancel/fail | Subscription lifecycle current snapshot maps active/trialing/past_due/canceled/no_plan, seat quantity, period and scheduled cancellation | Invoice paid/payment-failed events do not have a financial reconciliation consumer. Different application consumers interpret status differently. |
| Upgrade/downgrade | Established subscription can reconcile supported snapshots | Portal price-only changes can leave metadata plan/interval stale and fail closed. No supported application change operation coordinates these terms. No implicit replacement grant is safe. |
| Seat/deployment limits | `organizationSeatClaim.ts`, `deploymentQuota.ts`: public active-plan mapping and authoritative seats, transactional claims | Other limits use legacy registry and status-insensitive tier. Existing-member revalidation and Free fallback are not proof of complete commercial policy. |
| AI cost/credit | Gateway receipt reconciliation; settled 1.5x ledger; reservations/pending holds; signed paid credit fulfillment/refund replay controls | Base allowance is legacy flat tier, not the public per-paid-seat promise; Growth/custom overage continues beyond base pool. Included-pool vs additional invoice charging requires an approved commercial contract. |
| Stripe usage | `settleAIUsageToStripe.ts`: explicit test opt-in, per-organization ceiling, durable binding/provider keys and bounded recovery | Creates invoice items, not automatic finalized/paid invoices. Usage-invoice refunds/credits and paid/failed reconciliation remain unfinished policy/engineering. |
| Legacy application | `lib/entitlements.ts`, execution/run and axiom/execute-fixes read `User.plan` | Organization subscription webhook writes `TenantBillingPlan` only. Buying organization Pro does not synchronize this independent legacy authority. |
| Desktop | Paired identity and current accepted membership; hosted portal session, API-key rejection | `desktopCommercialAccessPolicy.ts` deliberately allows identity regardless of plan, contrary to ADR021's active-plan wall. This requires owner reconciliation, not a silent policy toggle. |

Current material allowance comparison (USD/month):

| State | Public listed allowance | Current AI admission/reservation base |
| --- | --- | --- |
| Missing/no-plan | Free $2 per organization | Starter fallback $25 per organization |
| Active Pro mapped to growth | $10 per paid seat | Growth $200 flat; metered overage |
| Active Enterprise | $30 per paid seat | Enterprise $5,000 baseline; custom-contract overage |
| Canceled/past-due growth | Public quota/seat mapping Free | Growth AI tier retained without status downgrade |

### Narrow authority corrections in this candidate

Subscription Checkout now requires `expectedOrganizationId`, captured when the
plans page displayed the workspace, and compares it with fresh authenticated
context before any member count or provider call. Missing/mismatched context
fails closed; refresh and explicit review are required. This value selects no
authority and cannot switch server workspace. Existing clients lacking it must
refresh/update instead of silently buying for another workspace.

Desktop billing portal now requests the shared resolver's existing current
workspace-admin boundary and explicitly disallows API keys. This aligns billing
management with browser owner/admin policy; it does not activate paid access or
prevent an inactive owner/admin from managing payment recovery. Membership and
role are re-read each request. Operator/read-only/finance-viewer/security-reviewer
cannot create a management portal session. Platform-admin browser exception is
not translated into a desktop email-based override.

### One owner decision packet — no automatic adoption

Approve a **versioned commercial contract**, explicitly identifying the canonical
public terms, AI credit basis, seat quantity, overage/included usage treatment,
inactive-status behavior and legacy-feature scope. Preserve existing subscribed
customers on their existing verified terms until an explicit reviewed migration
or replacement is authorized. Do not relabel all legacy Growth as new Pro or
reinterpret `User.plan` silently. Reuse `PUBLIC_PLAN_CATALOG` for approved new
contract calculations and keep a separate compatibility adapter for verified
legacy contracts; the current schema has no durable contract version or actual
subscription price/interval identity, so tier alone cannot distinguish them.
Record the resulting decision in DECISIONS before commercial enforcement changes.

Safe wiring (workspace binding and current billing-manager authorization) is
independent of this decision. Pricing amounts, credits, entitlement policies,
`User.plan`, production schema and billing activation remain unchanged.

Actual Stripe acceptance remains blocked on an explicitly approved isolated
runtime and securely available test account. Follow
`STRIPE_TEST_CUSTOMER_ACCEPTANCE.md`: exact test price/currency/interval/quantity
attestation, synthetic tenants, bounded provider writes, webhook evidence,
cleanup and approval reference. Annual price amount must be 12 times its listed
monthly equivalent. Do not run the legacy pricing sync script: it creates legacy
products/prices and accepts live keys. No test keys were inspected or enabled by
this audit. No successful payment, upgrade, invoice collection or customer
journey is claimed.

### Concrete commercial decision proposal for owner review

Recommendation: adopt the current public catalog **for explicitly new,
versioned subscriptions only**, after approval; retain verified existing customer
contracts unchanged. Proposed new terms are Free $0 with2 seats,10 deployments,
$2 AI/org/month; Pro $29/paid seat/month (annual $278.40/seat),100 deployments,
$10 AI/paid seat/month; Enterprise $79/paid seat/month (annual $758.40/seat),500
deployments,$30 AI/paid seat/month. Public prices are candidate terms, not an
assertion that they were approved. Existing flat $25/$200/$5,000 AI pools and
legacy prices must not be replaced by these amounts without contract evidence.

Proposed conservative new-contract access handling: active paid status uses
verified licensed seats; scheduled cancellation retains active terms through
provider cancellation; no_plan/trialing/past_due/canceled use the approved Free
allowances for new spending while preserving identity, historical records and
owner/admin billing recovery. Do not silently evict existing members or erase
workspaces. Legacy customers retain their explicit historical contract/status
rules until individually reconciled. This is a **proposal**, not current code or
an approved change; grace periods and legacy exceptions require confirmation.

Proposed new-contract AI charging: hard-stop at included plus verified purchased
credits by default; no automatic monetary overage without separate opt-in and
positive spending ceiling. Define whether the 1.5x settled customer amount first
consumes included/prepaid credits, with only uncovered opted-in amounts eligible
for invoicing; never invoice the same covered usage again. Existing invoice-item
worker currently submits opted-in settled billedCents, so this recommendation
requires explicit ledger/allocation design and tests, not a display-only change.
Enterprise negotiated contracts remain explicit exceptions. Preserve the1.5x
settled-provider-cost calculation; do not replace it with token estimates.

For legacy `User.plan` functionality, preserve current historical behavior until
a versioned organization→feature compatibility map is approved. Do not write a
purchasing user's global plan from an organization webhook: that could grant
features in another workspace. New organization-billed capabilities should read
organization-scoped authority, with existing customers grandfathered separately.

Required owner decision is one recorded contract encompassing these terms,
status/overage treatment and compatibility, or specific corrections to it. No
prices, balances, live subscriptions or enforcement policies changed in this
candidate. A durable contract version and verified price/interval identity need
reviewed storage before safe automatic grandfathering is possible.

### Isolated TEST setup sequence (access-dependent)

The coordinator's presence-only check found no available Stripe key, webhook
secret or DATABASE_URL and no exposed Stripe connector. Test-only validation is
authorized by the user, but actual execution remains technically blocked; no
secret values were inspected or printed. Do not request another general test
permission when secure access becomes available within that authorized scope.

1. Securely attach the existing Stripe TEST account and an isolated, synthetic,
   non-production database/runtime. Do not copy production data or change Vercel
   production environment. Establish schema through the approved isolated setup,
   not the production authentication migration procedure.
2. In the test dashboard verify existing approved test products/prices first;
   avoid duplicates. The proposed public licensed USD prices are Pro monthly2900,
   annual27840 and Enterprise monthly7900, annual75840 cents per seat. If absent,
   price creation requires the commercial decision above and the bounded test
   provisioning scope; do not run `scripts/sync-stripe-pricing.mjs`.
3. Store price IDs under STRIPE_PRICE_PRO_MONTHLY/ANNUAL and
   STRIPE_PRICE_ENTERPRISE_MONTHLY/ANNUAL; keep API/webhook secrets only in secure
   runtime configuration. Set AXIOM_STRIPE_MODE=test, the self-service flag only
   in that isolated runtime, and its exact authorized webhook destination and
   secret. No live-mode opt-in or production bindings.
4. Seed synthetic owner/member identities and organization locally. Use the
   current authenticated purchase UI, not a hand-crafted provider subscription
   lacking application metadata. Pause after uncertain outcomes until reconciled;
   recurring intent protection is still only proposed.
5. Follow the bounded customer acceptance packet for actual signed lifecycle,
   replay, credits, one bounded AI receipt, capped test invoice item and separately
   scoped test invoice/refund actions. Record private provider evidence and only
   sanitized statuses publicly. Compare every consumer's real behavior with the
   approved contract, without counting mocked tests as payment evidence.
6. Preserve evidence and perform only authorized synthetic test cleanup. Never
   reset production migrations, mutate real accounts or change support payments.
