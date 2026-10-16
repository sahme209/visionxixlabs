# Customer billing evidence availability

Reviewed 2026-10-15. This read-side change makes the canonical
`/control/usage-billing` surface distinguish unavailable evidence from a verified
zero. It does not change prices, quotas, access, credits, billing configuration,
provider calls, schema or production data.

## Customer-visible contract

Previously a member/usage/purchase read failure showed an alert but continued to
render initialized zeros, a computed “verified pool”, no transaction history and
an unlimited deployment denominator. A failed plan read was also indistinguishable
from an actual absent plan because the shared reader deliberately returns a
legacy no-plan fallback.

The page now follows these rules:

- Failed grouped member/usage/purchase evidence is shown as unavailable, not zero
  calls/tokens/paid top-ups, a settled zero amount, a credit balance or confirmed
  empty history. No computed pool is described as verified.
- Independently available deployment quota is preserved when another query
  fails. Missing quota is never rendered as unlimited. A known exhausted quota
  still displays its actual count and ceiling; explicit unlimited is rendered
  only when returned by an available quota decision.
- A failed plan read hides its plan identity, seat ceiling and calculated credit
  pool without hiding independently available usage or paid-transaction evidence.
  Portal actions are not enabled from an unavailable fallback customer binding.
- An actual missing plan remains the existing no-plan/Free presentation. Real
  successful zero aggregates and an actually empty transaction list remain zero
  and empty, respectively.
- Private storage errors are not rendered. Tenant filtering and existing
  authentication/management boundaries are unchanged.

`readBillingPlanWithAvailability` adds read evidence metadata around the same
normalization/fallback behavior. Existing `readBillingPlan` callers receive the
same plan-only result, including the historical no-plan sentinel on read failure.
The availability flag means the source read succeeded; it is not verification
of commercial policy, Stripe identity, or every plan field. Invalid stored plan
values retain the existing legacy normalization rather than changing entitlements.

## Regression evidence

`app/control/usage-billing/__tests__/page.test.ts` renders the actual async server
page and existing billing panel with simulated database/identity/quota IO. It
covers each grouped read outage, plan-only outage versus genuine missing plan,
legacy-reader compatibility, tenant query scope, genuine zero/empty state,
quota-only outage, exhausted quota and explicitly available unlimited results.
These are customer rendering regressions, not provider-backed billing acceptance.

The page still uses the existing displayed public plan pool formula. This patch
neither resolves public/legacy allowance policy nor adds pending-reservation
accounting to that display. It removes “verified pool” wording and does not claim
that an available read proves complete billing or real customer acceptance.

## Remaining substantive recurring Checkout blocker

The recurring subscription helper `createCheckoutSession` still has no durable
subscription Checkout intent or provider idempotency key. After an uncertain
create response, the current plans UI suggests trying again; that can create
another Checkout session/subscription rather than recover the first intent.
The existing prepaid-credit recovery must not be mistaken for recurring Checkout
recovery: it has a different durable purchase model and explicitly refuses unsafe
recreation when the original provider request cannot be reconstructed.

A coherent recurring recovery milestone needs reviewed durable authority for the
intent, actor/tenant, original financial/request parameters, provider identity,
bounded key retention and reconciliation/replacement. Do not repurpose the
credit-purchase table, invent a compatible request from current configuration,
blindly rekey an uncertain attempt or enable live billing to test it. Any new
schema is a separately reviewed proposal; no schema or execution is introduced
here. Actual subscriptions, Gateway receipts, invoices, refunds and replay still
require the explicitly approved isolated packet in
`STRIPE_TEST_CUSTOMER_ACCEPTANCE.md`.
