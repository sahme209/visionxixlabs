# Isolated TEST subscription lifecycle — audit, specification and plan

**Historical status-only acceptance.** The later financial review identified
that active status and original Checkout creation do not prove current payment.
Recovery/renewal authority from this document is superseded by
[the collected-coverage plan](ISOLATED_TEST_PAID_COVERAGE_PLAN.md). Its original
execution records remain evidence for their pinned source only. Current active
access requires separately collected calendar-aligned coverage; standard
mid-month service periods and general plan/seat changes remain unsupported.
Mid-month collection for an otherwise full aligned service line is supported.

Audit base: main PR160, `2682ba732ab1bd262dcaa378e3a6e3119d245229`.
Worktree: `/workspace/axiom-billing-test-lifecycle`; branch
`codex/billing-test-lifecycle`. Prepared 2026-10-16 for coordinator review before
implementation. This document neither activates a runtime nor asserts hosted
Stripe/payment acceptance.

## Intent and source findings

The owner-approved public Free/Pro/Enterprise catalog applies only to explicitly
new isolated TEST subscriptions. Existing customers, `User.plan`, live billing
and support-payment source/flow stay unchanged. The goal is one complete local
continuation after initial verified contract binding: current subscription state
changes the same application's allowance and admission, preserving its ledger.

The merged pricing navigation/workspace guard, durable recurring intents,
isolated Next/PG application bridge and original-create-proof adapter are already
present. They must be extended rather than recreated.

* `newTestSubscription/stripeTestProvider.ts` verifies only
  `checkout.session.completed`; it cannot process renewal, scheduled cancellation,
  cancellation or payment-problem subscription notifications. It compares current
  subscription seats with original checkout seats, so later licensed-seat changes
  also cannot pass through this SDK boundary.
* `newTestSubscription/service.ts` already fences provider observations against a
  previously read exact contract token. Its generic trusted fixture port can
  apply later status/seat snapshots, but still requires paid/complete checkout
  fields, has no event-type/period/cancellation observation and expects only the
  normalized application status vocabulary.
* `postgresFixtureStore.ts` already composes the shared
  `consumeSubscriptionEventInTransaction` with contract storage in a Serializable
  transaction. It currently labels every event `customer.subscription.updated`
  and loses period/cancellation fields. The shared consumer already owns durable
  replay, binding/token equality and cross-tenant customer/subscription conflicts.
* `verifiedContract.ts` joins immutable contract/originating-intent identity with
  current `TenantBillingPlan` status/seats/token. `isolatedApplication/plan.ts`,
  `currentAIAllowance.ts` and actual reservation logic already apply active-only
  paid seats, inactive Free, existing used/top-up/hold arithmetic and hard-stop.
* The owned PG fixture already covers synthetic status/seat changes, rollback,
  replay and concurrency. Its actual Next HTTP slice only observes the initially
  active contract. Neither fixture establishes real Stripe delivery or charging.
* Desktop access intentionally remains identity-only; isolated desktop/cloud and
  portal/checkout/webhook HTTP routes remain denied. Changing those is a separate
  policy/application milestone.

## Alternatives and selected slice

Recommended: extend the inactive TEST adapter/service to reconcile established
subscription lifecycle notifications, then prove the resulting application
allowance/admission with owned PG and actual local Next HTTP. This closes an
existing boundary without new runtime activation or financial authority.

A public webhook/portal/upgrade endpoint would require a new reviewed runtime
admission surface and actual secure provider access. A billing invoice collection
consumer would require financial allocation/collection policy and exceeds this
subscription-entitlement slice. Both remain deferred.

## Specification

1. The inactive adapter accepts signed `customer.subscription.created`,
   `customer.subscription.updated` and `customer.subscription.deleted` triggers
   only for an already bound verified new TEST contract. A trigger never creates
   a contract, recovers proofless purchase, changes plan/interval or replaces a
   customer/subscription. Metadata is lookup context, never original proof.
2. Verify persisted exact original-create proof and runtime/account/catalog/
   organization/intent/session/customer/subscription identity before retrieval.
   Independently read current account and retrieve the exact bound subscription.
   Validate full single licensed item, approved configured TEST price/product and
   frozen plan/interval. Licensed quantity must match both the exact current bound contract and the
   original proved paid quantity; all quantity changes remain unsupported.
   Original checkout quantity/terms/proof remain immutable. No subscription write
   or change request is added.
3. Signed event contents only trigger current-state retrieval; event IDs/times
   never order state. Map Stripe statuses to existing application states:
   active→active; trialing→trialing; past_due/unpaid→past_due;
   canceled/incomplete_expired→canceled; incomplete/paused→no_plan. Unknown status
   denies without consuming the event. Deleted notifications likewise retrieve
   and validate current state, rather than trusting the historical payload.
4. Carry actual event type, current period end and scheduled cancellation through
   the existing transaction consumer. Invalid period/cancellation observations
   deny before consumption. Preserve immutable contract identity and intent terms;
   all mutable observations remain in `TenantBillingPlan`, with no new schema,
   migration, event ledger or credit grants.
5. Recheck the original contract binding/token after provider IO; concurrent
   change loses without event consumption. Replay changes no state. Any composed
   write failure rolls back the event and observation together. Runtime/mode/
   provider denial is checked before each external IO, including flag drift.
6. Active scheduled cancellation retains paid allowance until provider state
   becomes inactive. Past-due/canceled use Free $2/org/month for new spending;
   active recovery restores the unchanged verified paid-seat pool. Renewal changes
   period observation, not credit balances or UTC-month allocation. Existing
   usage, purchased credits, unresolved holds, identity and records survive all
   transitions. Exhaustion denies before any new hold; recovery never enables
   generation because isolated provider denial remains absolute.
7. No new HTTP routes/allowlist entries, provider permits, support edits,
   production configuration, secrets or actual API calls. Plan/interval upgrades,
   downgrades, replacement, invoices, refunds and desktop/cloud access are outside
   this milestone. No hosted payment or complete paid customer journey claim.

## Implementation plan (inline execution after coordinator review)

### Task 1: Typed established-subscription observations and inactive SDK reads

Files: `lib/billing/newTestSubscription/service.ts`,
`lib/billing/newTestSubscription/stripeTestProvider.ts`, a focused pure lifecycle
validator if needed, and `lib/billing/__tests__/stripeTestLifecycle.test.ts`.

- [x] Write failing tests for signed lifecycle triggers on exact bound original
  proof, current-state retrieval, status mapping, scheduled cancellation, period
  validation, unchanged seats and unsupported quantity/plan/interval changes.
- [x] Cover unbound/proofless/foreign identities, malformed/paginated/mixed items,
  invalid signatures/live mode, account/runtime drift and zero IO under isolated
  application flag (including flag changes between awaited operations).
- [x] Extend `ProviderBoundary.verifyAndRetrieve` with typed event/lifecycle
  observation; preserve existing checkout behavior and legacy trusted fixtures.
- [x] Run focused adapter/service tests and confirm the new cases pass.

### Task 2: Existing durable consumer and owned PG lifecycle progression

Files: `lib/billing/newTestSubscription/postgresFixtureStore.ts`,
`lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts`.

- [x] Write failing actual PG assertions for event type, cancellation/period
  persistence, active→scheduled-cancel→past-due→active→canceled progression,
  current-state late delivery, duplicate replay and unchanged financial rows.
- [x] Pass observations to `consumeSubscriptionEventInTransaction`; retain
  Serializable token fencing, immutable contract body and originating intent.
- [x] Verify rollback leaves no event/state change and concurrent observations
  consume only the winner. Preserve current usage/top-ups/holds across transition.
- [x] Run owned fixture only with its existing explicit local opt-in, cached
  PG17 image and `db push --skip-generate`; never generate shared Prisma output.

### Task 3: Actual customer application evidence and documentation

Files: existing owned PG/Next test above;
`docs/ISOLATED_PUBLIC_TEST_APPLICATION_BRIDGE.md`,
`docs/STRIPE_TEST_ORIGINAL_ATTEMPT_PROOF.md`,
`docs/BILLING_CUSTOMER_JOURNEY_ACCEPTANCE.md`, this report.

- [x] Extend the existing authenticated local Next flow to observe scheduled
  cancellation retaining $30, past-due/canceled Free $2 with unresolved holds,
  denied exhausted admission with no new hold, and active recovery to the same verified
  paid seats without new credits/usage. Perform lifecycle updates through the service
  outside the app; retain route/provider denial inside the app.
- [x] Verify signed SDK remote reads remain mocked and synthetic trusted fixture
  setup is labeled; actual HTTP/SQL evidence must not become hosted Stripe proof.
- [x] Update corresponding documentation with precise local evidence/remaining
  gates, preserving support flow and existing-customer scope.
- [x] Request independent read-only review through the coordinator before full
  integration gates. Run focused lint/types first; coordinate heavy suites/build.

## Review focus

* A lifecycle event cannot bootstrap authority from signed metadata or an old
  checkout alone; only the exact existing verified contract qualifies.
* A delayed distinct event retrieves current state and cannot overwrite a newer
  concurrent local token. No lexical/timestamp event ordering is introduced.
* Subscription seat changes are denied without consumption or ledger mutation;
  the unchanged bound quantity must agree with the original paid terms.
* Scheduled cancellation must not revoke active paid access early, and payment
  recovery must not reset used/held/paid-credit evidence or mint credits.
* The inactive adapter must still stop before every SDK read if the isolated
  application flag is selected or becomes selected between asynchronous reads.

## Execution record

Coordinator reviewed and approved this plan on 2026-10-16 for inline execution.
Task1 source and tests are implemented:35 lifecycle cases plus existing proof,
contract and durable consumer regressions pass133 tests across5 files. Fifteen
new lifecycle cases failed before implementation; two further strict price-shape
and pagination cases failed before their guard changes.

Task2 first owned PG run failed on the expected missing cancellation/period
observation; its persistence fix passed6 tests with the HTTP case skipped.
Task3 initial actual Next/PG progression passed7 tests in46.46s. Final candidate
`d4b31cdc6de3772aaa443846047f070a83eace6a` adds the recovered100c admission/release
assertion and explicit existing-top-up and lifecycle rollback checks. Its final
owned HTTP/PG run passed7 tests in42.03s from a clean worktree under the
coordinator's exclusive window (Node24.19.0). No product/test changes followed.
Cleanup found zero owned commercial-test containers and no owned Next process;
an unrelated pre-existing Next server remained untouched. Focused source lint
passes. Initial web TypeScript
reported only missing desktop dependency-overlay modules; the approved local
overlay was linked and final TypeScript passed with exit 0 after the owned HTTP
run. This validation precedes the independent-review amendment below.

Ruling: this single document carries the approved spec, implementation plan and
execution ledger because the coordinator explicitly requested a concrete combined
report. It supersedes the skill's generic separate-document/scratch helpers.
The cost if wrong is document organization; no runtime authority changes.

Coordinator owns independent review, integration and full gates. Secure Stripe
account/key/webhook/prices remain unavailable; no actual Stripe API operation is
planned or claimed. The original source findings above describe the audit base,
not the implemented candidate.

## Independent review amendment

The independent review of `d4b31cdc` found one material P1: active subscription
quantity alone cannot prove collection for an enlarged paid-seat allowance. The
coordinator approved conservative unsupported behavior for every lifecycle
quantity change. SDK and service boundaries now require both the exact bound
quantity and consistency with original proved paid terms. Status recovery retains
the same three-seat $30 base. Price, interval, seat upgrades/downgrades and
replacement remain unsupported pending an explicit collection strategy.

Five new SDK/service regressions failed by incorrectly applying 3→4, 3→2 and a
drifted bound quantity before the fix. The owned PG checks now require rejected
quantity events to leave the event ledger, plan, credits, usage and holds intact.
Independent scoped review approved clean commit
`217695474371939a0899658b1874f3e4c658ee4b` with no further material findings.
At that exact clean source, the final owned PostgreSQL/actual Next run passed all
7 tests in 32.66s (2026-10-16 11:24 UTC), including unchanged three-seat recovery,
rejected increases/decreases with no event/plan/financial mutation, and the
100-cent provider-disabled hold/release. Final web TypeScript passed with exit 0
and no diagnostics. The approved Node 24.19.0 root/desktop dependency overlays
were reused; shared Prisma generation never ran. Cleanup found zero owned
commercial-test containers and no owned Next process. Focused tests passed
138/138 plus 15 demo-contract checks; focused lint passed. No product or test
changes followed this pinned acceptance. Full integration gates remain with the
coordinator. The earlier positive HTTP evidence is historical evidence for its
recorded source.

Ruling: reject all lifecycle quantity changes rather than infer payment from
active state — collection authority is absent — the cost is deferred TEST seat
upgrade/downgrade acceptance. Legacy/support behavior and the shared event
consumer remain unchanged.
