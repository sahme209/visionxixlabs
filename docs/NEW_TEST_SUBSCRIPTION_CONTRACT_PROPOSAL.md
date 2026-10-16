# New TEST subscription contract — additive review proposal

Decision received2026-10-16: use the current public catalog for **new TEST
subscriptions only**, preserving existing customers unchanged. This authorizes
local isolated implementation design, not live products/prices, production
migrations, production activation or changes to historical contracts. The integration includes main #150 and the pricing/navigation changes from
PR #151; earlier workspace/desktop management authority fixes are reused.

**This document proposes schema; it does not add a migration or runtime wiring.**
Actual Stripe TEST access is absent. Fixture evidence cannot be called checkout
payment acceptance. Support payments remain entirely outside scope.

## Exact new-test contract

Use immutable identifier `axiom_public_test_v1`, not legacy tier as provenance.
Paid contract choices: Pro2900 USD cents/month/seat or27840/year/seat;
Enterprise7900/month/seat or75840/year/seat. Annual equals12 times the public
monthly equivalent2320/6320, not12 times the undiscounted monthly price. Monthly
AI credits are1000/3000 cents per verified licensed paid seat; annual payment
still allocates monthly credits, not12 months immediately. Free is200 cents per
organization/month,2 accepted seats and10 counted deployments; paid deployment
limits100/500. Exact positive integer seat quantity comes from accepted members
at purchase snapshot and subsequently verified supported provider quantity.

Only newly created **synthetic isolated organizations** can enter this contract.
Any existing TenantBillingPlan subscription/customer, unresolved intent, legacy
contract, or organization outside the isolated synthetic allowlist rejects initial
activation. Tier growth or enterprise, public metadata, test key prefix or a
successful signature alone never qualifies an existing organization.

Unresolved policy: included/prepaid coverage versus invoiced overage. Keep new
contract hard-stop admission at its pool and **disable additional invoice-item
settlement for these test contract organizations** until covered-versus-uncovered
allocation is defined and tested. This proposal preserves legacy settlement and
1.5x settled ledger calculations. No new-test terms change legacy overage behavior.
Inactive/trial/grace-period policy also remains explicit owner review; locally
model only proposed Free fallback for new-test spending, keeping identity/history
and current owner/admin payment recovery. Do not deploy that policy implicitly.

## Proposed additive storage (no existing row backfill)

### RecurringSubscriptionIntent

- id opaque primary key; organizationId; initiatingUserId; clientIntentKey;
  catalogVersion fixed `axiom_public_test_v1`; testRuntimeId; livemode fixed false.
- planId Pro/Enterprise; interval monthly/annual; seatQuantity positive integer;
  currency USD; StripePriceId; verifiedUnitAmountCents; licensedSeatBasis true;
  expectedInitialCustomerId nullable only for new customer creation.
- immutable canonicalProviderRequest JSON, financial/request digest, stable
  providerIdempotencyKey unique, originalCreatedAt, immutable retryNotAfter.
  Request contains the exact original return URLs/email/customer decision so
  retries never reconstruct from changed environment/current membership.
- mutable outcome state prepared/attempted/unknown/session_confirmed/bound/
  terminal_verified; firstAttemptAt; checkoutSessionId nullable unique; customerId
  and subscriptionId when verified; sanitized reconciliation reason/time;
  attemptRevision nonnegative for equality-only CAS. No raw provider errors/keys.
- unique(organizationId,clientIntentKey); unique(id,organizationId). CHECK exact
  version/mode/currency/interval/quantity/amount/state and expiry shape.
- immutable financial/identity/request fields enforced by a reviewed SQL update
  trigger, not only TypeScript readonly; provider identities set-once thereafter.
  Define restricted snapshot retention because original email is PII.

### RecurringSubscriptionPurchaseFence

- organizationId primary key; activeIntentId unique nullable; testRuntimeId;
  revision nonnegative; composite FK(activeIntentId,organizationId) to intent,
  delete RESTRICT. No existing-organization backfill.
- Claim/update inside Serializable transaction; single organization row makes
  different-key concurrent purchases contend. Only verified terminal resolution
  can release a fence. Unknown/session expiration alone never releases it.
  All callers including other devices observe the same durable fence.

### OrganizationTestSubscriptionContract

- organizationId primary key; catalogVersion fixed as above; testRuntimeId;
  livemode fixed false; originatingIntentId unique; StripeAccountIdentity;
  StripeCustomerId unique; StripeSubscriptionId unique; initialCheckoutSessionId
  unique; acceptedFinancialDigest; verifiedAt; initialSignedEventId.
- composite FK(originatingIntentId,organizationId) to intent delete RESTRICT.
  immutable binding/provenance; no userId-wide feature grants and no updates to
  historical User.plan. No automatic replacement or contract-version overwrite.
- Current status/period/seats remain in TenantBillingPlan using the existing
  authoritative reconciliation; this immutable table proves **which contract**
  may interpret those observations. Exact binding equality is checked whenever
  mapping current state. Missing/mismatched provenance never grants new terms.

No financial/event ledger is repurposed. StripeBillingEvent remains the shared
durable replay authority. TenantBillingPlan columns remain backward compatible.
No new SQL is yet approved or generated; production application of this proposal
would require a separate reviewed migration/restore plan and explicit approval.

## Isolated runtime gate and trust boundary

No DATABASE_URL/DIRECT_URL fallback. Local implementation first accepts only an
explicit dedicated TEST database URL with loopback127.0.0.1 and fixed synthetic
rehearsal database name plus a locally provisioned runtime marker. No destructive
reset and no production seed. Remote provider-backed rehearsal requires a
separately verified isolated database binding/attestation and tightly scoped
runtime; environment variable labels alone cannot establish nonproduction.

Test provider client requires explicit test mode and approved test account
identity, test credentials and every response/event livemode:false. Secrets stay
in secure runtime; presence checks must never print them. Cross-account webhook
verification is prevented by endpoint-secret/test account attestation and the
provider account identity stored in provenance. No new live-mode escape hatch.
No hosted/production routes select this path merely because a caller supplies
catalogVersion. Eligibility is a server-owned runtime+synthetic organization gate.

Retrieve configured test price before admission: exact ID, USD, nondeleted,
active, recurring licensed per-unit, interval month/year count1, no transformed
quantity/tiered/mixed/metered items, exact approved unit amount, exact one complete
subscription item. Verify quantity/current snapshot and org/intent/version
metadata. A configured ID does not substitute for amount validation. Price
creation/reuse must follow the approved test provisioning scope; never invoke the
legacy sync-stripe-pricing script or modify an existing live price.

## Recovery, atomic consumption and compatibility

1. Validate current manager, origin, displayed workspace and isolated eligibility;
   freeze price/request snapshot and acquire organization purchase fence before
   dispatch. Only one durable claimant may attempt the provider operation.
2. Provider attempt uses one frozen key and exact original request, bounded
   timeout and no hidden retry. A lost response or local commit uncertainty
   remains unknown with the fence held. Do not issue a fresh intent/key.
3. Conservative retry deadline is fixed from original creation, less than Stripe's
   at-least24hour retention floor (propose23hours for review). Never treat the
   same old key as safe after expiry. Missing request or uncertain identity means
   reconciliation only. Operator reconciliation verifies exact checkout and
   possible subscription, not merely an expired checkout response.
4. Signed event triggers existing current provider retrieval. Establishing a new
   contract also requires exact durable intent/session/customer/subscription/
   account/version/mode/price/quantity match and newly eligible organization.
   Checkout/session evidence and subscription current snapshot must be composed;
   caller metadata or subscription.created alone cannot create provenance.
5. Extend the existing single Serializable event-consumption transaction with
   optional server-verified new-test contract preconditions and atomic immutable
   contract insert + intent/fence transition + TenantBillingPlan upsert. Do not
   call an existing transactional consumer from another transaction. Retain unique
   event insert rollback, ownership conflict checks and pre-IO binding/token
   equality. Replay after newer state remains no-op; no timestamp sorting.
6. Pure mapper receives an explicit verified contract discriminator and current
   matching state. With no contract, use the unchanged legacy mapping. With a
   valid isolated v1 contract, derive public per-seat credits/deployment/seats;
   missing/mismatched binding fails closed rather than falling back to legacy
   larger pools. Use the mapper inside existing reservation transaction and
   credit preflight; keep existing hold/usage/top-up ledger semantics. Do not
   alter provider-cost receipts, settlement price rounding or refund arithmetic.
7. Unsupported replacement, changed contract/price, provider404/timeout or
   incomplete/mixed snapshot remains unresolved and unconsumed. Existing legacy
   subscriptions continue their current path without new-contract reinterpretation.
   New-test organization settlement must not bypass the covered-usage policy hold.

## Required local composed evidence

- Real intent transaction + provider simulator: same/different-key races, exact
  request freeze, provider response lost then late signed binding once; unknown
  commit/old-key expiry/missing snapshot held; verified terminal permits new intent.
- Event consumption + current retrieval + contract insert + plan upsert: failure
  rolls back all rows including event; stale pre-IO token rejects; cross-tenant/
  mode/account/price/amount/quantity mismatch no allocation; replay A→B→A no drift.
- Pure mapper matrix: missing provenance retains exact legacy behavior; legacy
  Growth20000 cents stays20000, Enterprise500000 stays500000; new-test Pro3seats
  gets3000, Enterprise3gets9000; annual still monthly pool; inactive policy kept
  explicitly gated pending review; paid top-up/refund/holds compose without
  duplication. No new-contract invoice submission before coverage policy exists.
- PostgreSQL fixture proves unique constraints, immutable trigger, fence races
  and rollback, not actual Stripe acceptance. Actual hosted payment, renewal,
  failed payment, cancellation and cleanup remain access-dependent TEST evidence.

## Review checkpoint before implementation integration

Review the three additive tables, set-once immutability, exact isolated gate,
initial-binding correlation and atomic consumer extension first. Approve/revise
new-test inactive spending and covered-usage treatment before enabling those
branches. Local pure helpers/fixtures can then proceed while all live/production
paths remain untouched. Root coordinates migration proposal and integration;
this design does not apply schema, mutate customers or claim provider acceptance.

## Precise unresolved lifecycle rules — no authority from this proposal

Approval of new public TEST selection did not approve these interpretations:

| Decision | Recommended isolated-test rule for review | Why explicit |
| --- | --- | --- |
| Active/inactive spending | Active paid contract uses its pool; pending cancellation remains active until actual status changes. Past-due/canceled/no_plan/trialing proposes Free200c fallback only for new spend, preserving existing holds/history/identity and manager recovery | Grace periods and trial handling are not specified by catalog selection. Until approved, service returns policy_unresolved for new-contract spending rather than granting fallback or legacy allowance. |
| Monthly allocation boundary | UTC calendar month, matching current UsageEvent aggregation and current_month top-ups; annual subscription still monthly allocation | Stripe anniversary periods differ. Switching to anniversary requires coherent reservation/usage/top-up/receipt period storage, not silent subtraction across unlike periods. |
| Seat increase | Only supported authoritative provider snapshot changes licensed quantity; calculate current month's pool from verified seats | Accepted member count is purchase quantity snapshot, not perpetual billing authority; invites must not mint AI credits. |
| Seat decrease | Proposed current quantity pool minus current period settled usage and all active/pending holds, clamped0; block new spend when exhausted; never erase used cost or release unknown holds | Midmonth proration/credit grant policy may instead require an immutable monthly allocation snapshot. Owner must choose; catalog does not specify it. |
| Included/prepaid versus invoice | Hard-stop new-contract spending at approved pool; no usage-invoice submission until covered/uncovered allocation approved | Existing worker invoices settled billedCents and is not a coverage allocator. Disable it for new-test contracts rather than double billing included credits. |
| Legacy compatibility | No contract row→unchanged legacy path; explicit isolated new lane missing/mismatched row→unavailable, never larger legacy fallback | Version/provenance must not cause grants from caller JSON or turn storage outage into legacy pool. |

Next coherent implementation unit is one internal default-disabled service:
explicit isolated repository + provider boundary, immutable intent/fence, signed
current snapshot binding and atomic event/plan/contract transaction, with real
owned empty PostgreSQL fixture exercising the service. Pure term/recovery kernels
are preliminary building blocks, not an end-to-end implementation milestone.
Any unresolved status/period/seat rule returns policy_unresolved and cannot permit
AI spend. Existing operational routes remain untouched until a separately
reviewed integration is authorized. No real Stripe checkout success is implied.

## Implemented actual-application isolated fixture slice · 2026-10-16

`newTestSubscription/service.ts` composes server-counted accepted seats and
current management authority, exact price/request freeze, durable attempt claim,
unknown hold, verified-boundary late observation, event/plan/contract/intent atomic
binding and current-role credit preview. No public route/live adapter selects it.
Catalog version labels and signatures alone are not attempt provenance: the
trusted provider boundary must independently establish the original request key
and digest, exact account/session/customer/subscription binding. Real provider
implementation of that boundary remains missing; fixture proof is synthetic.
Frozen account identity is checked before dispatch and after provider IO.

The fixture constructs a **full current application schema** with Prisma db push
--skip-generate only after an owned random-loopback database is confirmed empty.
It refuses local .env files and overrides all database URL variables for that
child process. It never runs migration deploy, resolves history or resets data.
Existing generated delegates are reused; no shared client generation occurs.

Actual OrgMembership governs seats/management; actual TenantBillingPlan is the
only current subscription status/quantity/token authority; actual StripeBillingEvent
stores replay consumption; actual UsageEvent, AIUsageReservation and AddOnPurchase
supply cost/hold/top-up evidence. The separate proposed intent/fence/immutable
provenance tables contain no alternate mutable balance or plan status. Parameterized
adapter SQL constructs its own client from an explicitly guarded fixture URL,
requires a runtime marker and fails closed if new tables are absent. Legacy
callers never query these new tables. Actual PostgreSQL triggers protect frozen
intent terms/set-once provider IDs, immutable contract identity and revision CAS.

The original consumer transaction body is extracted without changing its outer
replay/ownership/rollback semantics. Internal composition invokes that helper in
the same Serializable transaction as provenance and intent writes and requires an
applied outcome. Existing production wrapper and call sites remain unchanged.
The actual existing reserveAICredits ledger receives an internal plan resolver
only from this guarded fixture lane: it independently checks durable verified
contract/current binding inside the same transaction, **before even accepting an
existing idempotent hold**. The default legacy path retains its existing mapping
and never queries provenance. No request-body callback/version grants authority.
New-contract hard-stop allocation composes existing paid-top-up/used/pending-hold
reads; the existing settlement function and established1.5x margin arithmetic are
reused. No separate charging ledger is added.

Isolated TEST assumptions: active paid/Free inactive mapping consistent with
existing deploymentQuota, UTC calendar month, current verified licensed seats,
remaining=max(0,allocation+verified top-ups-used-held). Annual still monthly pool.
These are not new live terms; no historical subscription is reinterpreted.
Preview operationalPermit and invoiceSubmissionEnabled are literallyfalse; no
User.plan grants, invoice items, runtime production routes or live adapter added.

Validation (explicit owned-container resource opt-in):

```sh
AXIOM_RUN_OWNED_COMMERCIAL_FIXTURE=1 npx vitest run lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts lib/billing/__tests__/newTestSubscriptionContract.test.ts lib/billing/__tests__/consumeSubscriptionEvent.test.ts lib/billing/__tests__/aiCreditReservation.test.ts
```

The fixture uses only cached postgres:17-alpine --pull=never, a unique container,
random synthetic credentials, random127.0.0.1 port and dedicated initially empty
database. Teardown disconnects all clients and removes only that owned container.
Without opt-in the PostgreSQL test is skipped. Tests cover unknown outcome/late
binding/replay; exact price/amount/annual/quantity/account/attempt evidence;
current-seat checks; atomic plan/event rollback on injected failure; SQL
immutability; separate-client Serializable purchase and stale-observation races;
actual AI hold/cap/settlement using2c synthetic provider amount→3c ledger; pending
holds preserved; new-table absence blocks new lane while legacy reserve still
works; current-role downgrade blocks even an existing hold replay. Existing
consumer/reservation regressions are compared before/after refactoring.

**Evidence limits:** no Next browser/HTTP customer workflow, hosted Stripe
Checkout/payment/renewal/refund, real Gateway cost receipt or external provider
call is verified. Snapshot/signature/attempt evidence is provider-simulated.
Actual Stripe credentials/runtime are absent. No production schema or data,
existing customer pricing, User.plan or support-payment behavior changed. Future
integration needs reviewed new-table DDL, real independent provider-attempt
reconciliation, server-selected isolated lane and actual secure Stripe TEST
acceptance. Production activation remains separately approval-gated.


## Mandatory application-exposure gate

The owned database must **not** be connected to an unmodified running application:
a new-test compatibility `growth` plan would otherwise select the legacy $200
flat pool through public AI/feature routes. A preview's operationalPermit:false
is not a guard on those routes. All admission, read and background/provider entry
points for this version must select a verified version resolver or explicitly
deny; missing/unavailable new provenance may never fall back to legacy. Website
balance reads likewise remain legacy until the reviewed isolated bridge exists.
See [the concrete application bridge audit](NEW_TEST_APPLICATION_BRIDGE_AUDIT.md).
Actual Next/hosted Stripe acceptance remains unverified and this exposure gate is
not implemented by the current fixture slice.
