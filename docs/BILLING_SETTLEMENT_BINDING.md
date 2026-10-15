# AI usage settlement binding

A persisted reservation must match the current reconciled usage event before
Stripe submission: organization, usage event and exact billed cents. Previously,
an existing reservation was returned from the transaction and its amount and
organization were trusted without comparing them with the selected usage event.

Four regression cases reproduced submission for another organization, another
usage event, a larger amount and a smaller amount. A pure binding predicate now
blocks those cases before the Stripe call. The batch reports the row blocked
and retains its reservation and idempotency key for reconciliation; existing
ledger rows and quota reservations are unchanged.

The valid retry path still uses the original amount and key within the existing
conservative retry window. Expired/unknown/failed outcomes remain held, submitted
rows remain excluded, and disabled or live-mode billing is rejected before
repository access. Pricing, cost reconciliation and the 1.5x kernel are unchanged.

Evidence: `lib/billing/__tests__/settleAIUsageToStripe.test.ts` exercises the real
worker with a mocked Stripe boundary and verifies zero invoice/ledger writes
for all four mismatches. Existing retry/unknown-outcome/test-mode cases still
pass. This is boundary evidence, not a completed customer/provider billing trial.
No migration, production data repair or live billing activation is involved.

Next: inspect actual approved test-tenant receipts and ledger consistency before
any billing rollout. Contradictory historical records require reviewed
reconciliation. Batch fairness for held/disabled rows remains open.

## Held reservations and bounded selection

Candidate selection now excludes submitted, failed, blocked, unknown, expired,
future-dated and tenant/amount-mismatched existing reservations before the batch
limit. The same exported 23-hour retry bound is used by selection and the final
worker check. Excluded records and monthly holds remain unchanged; no provider
outcome is inferred and no idempotency key is reset. New unreserved usage remains
eligible. The worker retains its fresh retry-time, tenant binding, configuration,
serializable budget and test-mode checks.

An isolated SQL fixture places eight older ineligible records ahead of a recent
retry and new usage, including the exact retry boundary. Selection still returns
the eligible work in a one-row batch. This is a bounded selection improvement,
not complete queue fairness: disabled customers, exhausted budgets and repeatedly
failing but still eligible retries can still crowd a batch. Those remain open.
No migration, live billing, production data mutation or credential change occurs.

The generated selection query was also executed against a disposable PostgreSQL
16 fixture with native timestamp columns and mixed-case quoted identifiers; it
returned the eligible retry despite older held rows. The container was removed.

Local validation: web/desktop TypeScript, 539 Vitest files / 5,339 tests,
desktop frontend build, 30 Python CLI tests and mission register check pass.
The internal governed AI-usage walkthrough reflects held-row selection. No
production or real Stripe request was used for these checks.

## Configuration and budget eligibility before LIMIT

After #124 preserved and excluded reconciliation holds, candidate selection also
requires enabled positive-cap configuration and a nonblank attached Stripe
customer. New usage must fit the current UTC month's remaining capacity;
missing monthly counters mean no prior reservation, while negative counters
fail closed. Existing valid retries are already reserved and remain eligible
even when their configured cap is spent. Configuration/customer and serializable
budget checks still run in the worker after selection, handling concurrent
changes. Selection and reservation use the same captured UTC month; the final
retry-age check still uses fresh time immediately before provider submission.

This SELECT creates no reservations and mutates no records. SQLite cases cover
older disabled/missing/blank-customer/exhausted/over-cap records, exact remaining
capacity, previous-month isolation, missing configuration/plans and retries at
a spent cap. The generated SQL was independently executed on PostgreSQL 16.
Eligible repeated provider failures can still crowd the ordered batch; a durable
fair retry schedule and actual isolated Stripe test-mode customer journeys remain
open. Live settlement remains disabled and rejects live keys.

Validation for the configuration/budget follow-up: 539 Vitest files / 5,344
tests, web and desktop TypeScript, desktop frontend build, 30 Python CLI tests,
mission register check and disposable PostgreSQL capacity fixtures passed.

## Durable rotation of eligible retries

After #125's eligibility filters, repeated provider failures could still occupy
the oldest batch slots. Candidate ordering now uses each existing settlement's
`updatedAt`, falling back to usage creation for unreserved work, with stable
creation/id tie-breakers. Before a provider request, a conditional write persists
`attemptCount` and `updatedAt` on the exact reserved identity/amount/key. Failure
to persist or a concurrent state change defers the row without contacting Stripe.
A fresh retry-deadline check follows that write. Success no longer increments the
attempt counter a second time. The counter measures dispatch attempts, including
an intent persisted before a crash; it is not proof of provider delivery.

Neither reservation creation time nor idempotency key changes, so queue rotation
cannot extend the original 23-hour automatic retry window. Unknown outcomes keep
their financial holds. Five regressions failed before and pass after: one-row
rotation, durable unknown-outcome marker, marker failure, concurrent state change,
and deadline expiry during marker persistence. The real SQL runs on isolated
SQLite and PostgreSQL fixtures. This improves cross-batch eligibility scheduling;
it does not implement exponential backoff, exactly-once provider execution or
unconditional fairness during database outages/transaction contention. Real
Stripe test-customer acceptance remains blocked by isolated runtime access.

Retry-rotation validation: 539 Vitest files / 5,348 tests, web/desktop TypeScript,
desktop frontend build, 30 Python CLI tests, targeted settlement regressions,
mission check and the generated PostgreSQL ordering query passed locally.
