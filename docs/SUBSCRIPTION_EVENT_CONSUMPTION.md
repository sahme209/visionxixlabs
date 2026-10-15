# Atomic durable subscription-event consumption

Reviewed 2026-10-15. Billing activation, commercial entitlement rules and Stripe
provider actions are unchanged. No migration or production execution is part
of this change.

## Contract

The signed billing webhook previously checked only `TenantBillingPlan`'s latest
`lastStripeEventId` and then performed a separate upsert. A previously consumed
A event could overwrite B on A → B → A delivery. Ownership checks and the write
were not one transaction.

`lib/billing/consumeSubscriptionEvent.ts` now performs a Serializable transaction:

1. Insert the signed event ID/type into existing `StripeBillingEvent`.
2. Honor the existing latest-event pointer for rollout compatibility, adopting
   it into the durable ledger without updating the plan.
3. Check whether a different tenant already owns the customer or subscription.
4. Upsert the exact existing plan/status/seat/customer/subscription mapping.

The event insert and plan write commit together. A duplicate-key failure at
**the ledger insert only** is acknowledged as replay; unrelated unique errors
are not swallowed. Ownership failure rolls back event consumption. Storage,
serialization or plan-write failure returns retriable HTTP 503 with a generic
message, without exposing database error details. Stripe can redeliver the event.
A lost commit acknowledgement can leave an unknown response outcome; retry checks
the durable ledger rather than claiming that every storage error proves no write.
The existing global billing activation and signature checks still precede this
consumer. The credit-purchase event/refund transaction paths remain separate.

`StripeBillingEvent` already exists with provider event ID primary key, event
type and processed timestamp. No schema change, new activation flag, pricing
mapping, entitlement policy or provider fetch is introduced. Missing event-table
schema fails closed; the pre-existing production recovery gates remain required.

## Evidence and limits

The helper's stateful transactional simulator tests durable A → B → A replay,
plan failure rollback/retry, ownership conflict rollback/retry, legacy-pointer
adoption, serialization failure propagation and non-ledger unique-error handling.
Webhook route tests verify signature/activation gates, existing public Pro →
growth mapping and seats, missing-identity rejection, credit/refund routing,
durable replay acknowledgement, ownership conflict and retriable storage error.
These are local regressions, not actual Stripe or PostgreSQL concurrency acceptance.

Serializable predicate reads protect concurrent ownership checks when the
existing supported PostgreSQL transaction isolation is honored. An SSI conflict
is retriable, not automatically retried inside the webhook. Separate provider
and SQL acceptance must verify this behavior against the isolated test runtime.

**Distinct-event ordering remains unresolved.** A never-before-consumed delayed
subscription update can still represent older provider state. Event IDs are not
ordered, and `processedAt` is not Stripe event time. This patch does not invent
ordering metadata, compare lexical IDs, revoke legitimate subscription changes,
or treat cancellation as permanently irreversible. Reconciliation against an
authoritative Stripe subscription snapshot requires its own reviewed design.
Historical pre-rollout events older than the current last-event pointer cannot
be reconstructed from the existing database and are not retroactively deduplicated.

Subscription cancellation/past-due treatment, public versus legacy allowances,
invoice finalization/payment, usage-invoice credits/refunds and any live billing
activation remain separate policy and engineering milestones. See
`BILLING_CUSTOMER_JOURNEY_ACCEPTANCE.md` for test-runtime prerequisites.
