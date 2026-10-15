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
