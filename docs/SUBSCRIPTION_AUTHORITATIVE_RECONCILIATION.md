# Established-subscription authoritative reconciliation

Reviewed 2026-10-15. No schema, production execution, provider call or commercial
policy activation is part of this source change. Real Stripe acceptance remains
unverified.

## Problem and scope

Durable event IDs prevent repeated consumption of the same event. They do not
make a never-consumed delayed subscription payload current. An older active
payload can otherwise overwrite a newer canceled state, and subscription items
must not all be assumed to be paid seats.

Signed subscription events now trigger retrieval of the exact established
subscription. Its current validated snapshot supplies status, plan, seats and
period information. The signed event's old status/quantity and creation time
are not applied as authority. Stripe `event.created` has second precision;
equal timestamps, lexical event IDs, delivery order and processing timestamps
are not subscription versions. No timestamp sort or status-precedence rule is
introduced.

## IO, identity and concurrency boundary

`reconcileSubscriptionEvent.ts` checks declared Stripe mode/key agreement and
requires the existing explicit live approval flag for live mode. The event and
retrieved snapshot must both match that mode. It short-circuits already consumed
events without another provider retrieval, captures the tenant's existing
customer/subscription/last-event binding, then retrieves the exact subscription.
The default SDK request retains API version `2024-06-20`, uses a ten-second
transport timeout and disables SDK network retries. Retrieval is read-only;
404, timeout, malformed or mismatched evidence does not imply cancellation.

Returned subscription ID, customer and tenant metadata must match. A deleted
expanded customer is rejected. The price/seat contract is the existing canonical
Checkout shape: one complete non-truncated item, expanded recurring USD
per-unit licensed price, no quantity transform, configured approved plan/interval
price ID, expected month/year interval with count one, positive integer unit
amount and positive integer seat quantity. Mixed, metered, missing, transformed
or truncated items remain unconsumed. Configured approved price IDs remain the
price authority; this patch does not reprice against public catalog amounts or
settle broader legacy/public commercial terms. Missing interval metadata or
price configuration needs reconciliation rather than a guessed seat count.

After retrieval, the existing durable consumer performs one Serializable
transaction: insert unique event ID, preserve legacy latest-event adoption,
reread and compare binding/token/existence, check tenant ownership, and upsert
the existing mapped plan. An established binding cannot be replaced at this
boundary. Ledger and plan either commit together or roll back together. Credit
checkout/refund transactions remain separate and unchanged.

`lastStripeEventId` is an **equality-only** observation token. Each newly applied
event changes it to a unique consumed event ID. A late provider response captured
before another handler's commit loses that fence and cannot write or consume
its event. A competing first binding also loses the row-existence check. The
caller receives retriable HTTP503 and Stripe can explicitly redeliver/refetch;
there is no automatic unbounded retry. Serializable conflicts likewise retain
the unconsumed event and prior state.

This fence depends on all authority-changing subscription writers preserving
the token invariant. The current application consumer is the only identified
caller that writes recurring subscription authority; trial setup does not
update an existing row. Future writers/manual reconciliation must coordinate
with this invariant. `updatedAt` alone is not used as a collision-free revision.
The provider may change again after a retrieved snapshot; subsequent delivery
or reconciliation is still required. This is not a claim of a transaction
spanning Stripe and PostgreSQL or of permanent external exactly-once semantics.

## Binding and replacement limitation

An initially unbound tenant may bind the exact retrieved incoming subscription,
subject to the existing signed tenant/ownership contract and transaction fence.
An event naming a different subscription or customer for an established binding
returns HTTP409 `stripe.replacement_requires_reconciliation`. In particular, a
late deletion of old subscription A cannot cancel current subscription B.
No automatic replacement, revival or “canceled always wins” rule is inferred.

Legitimate replacement/recheckout requires a reviewed authorized replacement
intent or equivalent durable authority (actor, prior binding, intended terms,
expiry and consumption). The existing recurring Checkout path does not persist
that intent. Existing subscriptions with incompatible/missing metadata or
unavailable price mappings therefore require operator reconciliation. This safe
restriction is not completion of replacement UX or subscription migration.

## Evidence and remaining acceptance

`reconcileSubscriptionEvent.test.ts` composes the actual reconciliation and
transaction consumer over simulated provider/storage boundaries. It covers:

- supported lifecycle mappings, current canceled state despite an old trigger,
  equal timestamps and non-monotonic lexical IDs;
- deferred stale retrieval after a newer commit, explicit safe refetch and
  competing first binding;
- unexpected replacement/old deletion, identity/customer/tenant/mode/status
  mismatch, malformed seats/periods, and ambiguous price/item evidence;
- provider failure, absent price configuration, credential changes in flight,
  serialization failure rollback and bounded SDK options;
- durable replay without retrieval and unchanged local plan/event on rejection.

Existing consumer tests retain rollback, tenant conflict, legacy-pointer
adoption and duplicate handling. Existing webhook tests retain signature,
activation, identity and credit/refund routing. Local tests use invented keys
and simulated SDK calls only. They do not prove Stripe delivery, PostgreSQL SSI,
invoice collection, production authentication, subscription replacement or
commercial policy consistency. Use `STRIPE_TEST_CUSTOMER_ACCEPTANCE.md` for the
separately approved isolated provider-backed exercise.
