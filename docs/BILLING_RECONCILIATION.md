# Billing reconciliation boundary

Status: review-only. Self-service checkout must remain disabled until every activation item below is complete and explicitly approved.

## Current authorities

| Concern | Current implementation | Authority today | Decision for the new model |
|---|---|---|---|
| Customer-facing proposal | `lib/billing/publicPlanCatalog.ts` | Display only | Free, Pro, and Enterprise remain a proposal until activation |
| Organization subscription | `TenantBillingPlan` through `lib/billing/tenantBillingStore.ts` | Preferred commercial authority | Keep as the single organization-level source of truth |
| Organization webhook | `POST /api/billing/stripe-webhook` | Signature-verified, metadata-scoped, replay guarded, and fail-closed when ownership cannot be checked | Canonical Free/Pro/Enterprise webhook; only complete subscription lifecycle events grant or remove entitlements, and Stripe customer/subscription ownership cannot move between workspaces |
| Legacy user subscription | `User.plan` through `POST /api/webhooks/stripe` | Legacy compatibility path while self-service billing is off | Returns `410` once the new billing flag is enabled so both authorities cannot write concurrently |
| Legacy feature catalog | `lib/billing/tierCatalog.ts` | Used by existing platform limits | Replace with organization entitlements through an explicit migration |
| Legacy pricing registry | `lib/billing/planRegistry.ts` | Internal historical pricing and AI limits | Do not expose as the new public pricing model |
| Checkout | `POST /api/billing/checkout-session`; old URL is a code alias | Disabled by default | Organization owner/admin only; accepted seats are counted server-side; requires explicit activation |
| Billing portal | `POST /api/billing/portal-session`; old URL is a code alias | Disabled by default | Organization owner/admin only; resolves the customer from `TenantBillingPlan` and returns to `/account` |
| Public plan selection | `/plans` | Preview while billing is disabled | Monthly/annual selection is click-driven; Free goes directly to download, while approved paid checkout uses the canonical organization endpoint only after the activation flag is enabled |
| Account plan management | `/account` | Reads fail-closed organization plan state | Shows the authoritative plan/status to members; an owner/admin can open the customer-scoped Stripe portal only after billing is enabled and a verified customer exists |

## Proposed public contract

| Plan | Monthly price | Annual equivalent | Seats | Counted deployments | Governed AI allowance |
|---|---:|---:|---:|---:|---:|
| Free | $0 | $0 | 2 included | 10/month | $2/organization/month |
| Pro | $29/user | $23.20/user | Paid seats | 100/month | $10/paid seat/month |
| Enterprise | $79/user | $63.20/user | Paid seats | 500/month | $30/paid seat/month |

The AI amounts are proposed service credits, not tokens and not provider-cost
pass-through. Before activation, metering must use the recorded provider cost,
apply the approved retail rate once, and expose both consumed and remaining
credit without revealing provider credentials. Security controls remain
identical across all plans.

A counted deployment is one successfully dispatched, approved deployment workflow for one environment. Polling, validation retries, and automatic rollback for that dispatch do not count again. Rejected, canceled, and failed-to-dispatch proposals do not count.

## Stripe configuration contract

Test-mode validation requires all of the following. Values are environment
references only; no secret or price identifier belongs in source control.

| Variable | Required behavior |
|---|---|
| `AXIOM_SELF_SERVICE_BILLING_ENABLED` | Remains unset/false until the test journey and entitlement migration are approved |
| `AXIOM_STRIPE_MODE` | Must be `test` while validating; must match the secret-key prefix |
| `STRIPE_SECRET_KEY` | Must begin with `sk_test_` in test mode |
| `STRIPE_WEBHOOK_SECRET` | Signature secret for the canonical organization webhook |
| `STRIPE_PRICE_PRO_MONTHLY` | Approved recurring per-seat Pro monthly price |
| `STRIPE_PRICE_PRO_ANNUAL` | Approved recurring per-seat Pro annual price |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | Approved recurring per-seat Enterprise monthly price |
| `STRIPE_PRICE_ENTERPRISE_ANNUAL` | Approved recurring per-seat Enterprise annual price |
| `AXIOM_LIVE_BILLING_APPROVED` | Must remain false/unset; a live key cannot create checkout without this second explicit lock |
| `AXIOM_AI_USAGE_BILLING_TEST_ENABLED` | Must remain unset/false outside the isolated Stripe test environment. This is a separate opt-in for AI usage invoice items. |

## AI usage settlement contract

`UsageEvent` is settled only after Vercel Gateway provides its authoritative
generation cost. The platform then computes the customer amount exactly once
as the settled event's `billedCents` (the governed 1.5x amount). A durable
`AIUsageBillingSettlement` ledger records the Stripe idempotency key before an
external request, and `AIUsageBillingPeriod` reserves the workspace's monthly
limit in a serializable transaction. The reservation guards the configured
ceiling. Automatic submissions require a `reserved` row less than 23 hours old,
using its original key and amount. Stripe API v1 can prune idempotency keys
after 24 hours, so a durable local key alone is not perpetual deduplication.
The one-hour buffer limits automatic replay exposure; it is not proof of
provider failure or a general exactly-once guarantee.

Old reservations, invalid/future timestamps, and other unsettled ledger states
are counted as blocked and retained unchanged for reconciliation. Submitted
rows are never resubmitted. A provider timeout retains the reservation and
monthly allowance. No automatic release, replacement key, or retry-window
reset is provided. Before any approved recovery, an operator must inspect the
provider's invoice-item evidence and the exact settlement/customer mapping.
An operator reconciliation workflow and live test-mode acceptance remain open.
Reference: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Settlement is deliberately **test-mode only** in this release. The protected
`/api/cron/settle-ai-usage` job rejects any live key, any mode/key mismatch,
and any workspace without all of: an enabled `AIUsageBillingConfig`, a
positive `monthlySpendLimitCents`, and a Stripe customer attached to its
`TenantBillingPlan`. It creates test-mode invoice items only; it neither
finalizes an invoice nor collects a payment.

Before scheduling that job in Vercel, an operator must create an isolated test
workspace, attach its Stripe **test** customer id, set a positive capped
`AIUsageBillingConfig`, and add `AXIOM_AI_USAGE_BILLING_TEST_ENABLED=true` to
the test environment. Production must keep that flag unset. A live rollout
requires a separately approved design for invoice finalization, credits and
refunds, tax treatment, and customer notice; no code path here enables it.

Checkout metadata records only `organizationId`, public `planId`, interval,
and server-counted seats. A successful redirect never grants access. The signed
`customer.subscription.created|updated|deleted` lifecycle is authoritative.

## Required activation sequence

1. Approve the public prices, 20% annual discount, deployment allowances, and AI-credit economics.
2. Review the implemented immutable public plan identifiers and monthly/annual Stripe price mappings on the organization billing path.
3. Define a migration from legacy `User.plan` rows and existing Stripe subscriptions to `TenantBillingPlan`; produce a dry-run report before writing data.
4. **Deployment and seat concurrency complete.** Deployment dispatch reserves an organization allowance slot in a serializable transaction and binds it to a unique organization/idempotency key. Invite acceptance and enterprise SSO now claim accepted seats transactionally; paid plans fail closed unless the signed Stripe subscription supplies a positive seat quantity. Legacy-plan migration and Stripe test-mode reconciliation remain below.
5. **Implemented for AWS ECS desktop, Agent and Airflow dispatch.** Active reservations temporarily consume a slot; explicit non-accepting GitHub responses release it, accepted dispatches settle the same durable execution row, unresolved reservations retain their quota and idempotency key until their outcome is reconciled, and exact retries replay the prior recorded execution without dispatching twice. Age alone does not prove that an external dispatch failed; automatic stale-reservation deletion is disabled. This conservative hold can reduce available allowance after an interrupted request. A governed receipt-reconciliation/release workflow remains unfinished; desktop and Agent callers release only explicit non-accepting GitHub 400/401/403/404/405/410/422/429 responses. Network failures, timeouts, server errors and unfamiliar response formats retain the hold and return `deployment_outcome_unknown`. They require external-outcome reconciliation, rather than an automatic resend. The Agent ledger retains its existing failed processing status but records that the provider outcome is unconfirmed; it does not assert provider failure.
6. Cover upgrades, downgrades, renewals, cancellation, past-due state, refunds, and webhook re-delivery in integration tests.
7. Verify the same entitlement response is consumed by the website, desktop app, and every mutating API boundary.
8. Create or reconcile versioned Pro and Enterprise recurring per-seat prices in Stripe test mode only; Free has no Stripe price.
9. Run Stripe test-mode customer journeys and reconcile invoices, seats, usage, and webhook state.
10. Obtain explicit approval before setting `AXIOM_SELF_SERVICE_BILLING_ENABLED=true` or creating live prices.

## Fail-closed rules

- Gateway cost reconciliation requires the returned generation ID to exactly
  match the usage event's captured request ID before any usage/reservation
  mutation. Unrelated or empty receipts remain pending for investigation;
  they cannot provide cost evidence for settlement.
- A marketing page never grants an entitlement.
- A checkout redirect never grants an entitlement.
- Unknown plan, price, organization, or webhook metadata is ignored or rejected rather than guessed.
- A subscription event cannot mutate access without event, customer, and subscription identifiers or when replay/ownership storage is unavailable.
- A Stripe customer or subscription already assigned to one workspace cannot be reassigned through webhook metadata.
- Fundamental approval, audit, and production-safety controls are never removed because of plan state.
- Existing subscriptions are preserved until their migration is individually reconciled.

## Verification evidence — 2026-10-12

- Website/server TypeScript: pass (`npx tsc --noEmit`).
- Desktop TypeScript: pass (`npx tsc -p desktop/tsconfig.json --noEmit`).
- Full Vitest suite: 501 files / 5,008 tests pass.
- Reservation coverage includes quota exhaustion, exact replay, payload-conflict rejection, failure release, and accepted-dispatch settlement.
- No billing flag, live Stripe setting, subscription, deployment, or production release was changed.

Airflow uses the same serializable quota reservation with a stable execution
key and settles the same deployment row, preserving the recorded approver as
actor when present. It releases a new reservation only for a pre-dispatch
failure; after its provider request begins it conservatively holds all failed
outcomes for reconciliation. These paths do not change public plan limits.

## Desktop visibility for unresolved dispatch holds

Concurrent observation responses use a snapshot compare-and-set. A delayed
response cannot overwrite a record changed by another observer while its
provider reads were in flight. A conflict returns the current tenant-scoped
record without a stale transition audit. This does not reconcile missing
receipts, release holds, or guarantee provider responses themselves are fresh.

A reserved execution or an execution without a provider run receipt is labeled
“Dispatch outcome awaiting verification”, rather than active deployment. It
does not start a five-second observation loop with no run to observe. Existing
recorded active runs retain automatic polling. A Refresh status action uses the
existing observation endpoint to reread recorded/provider status; it never
dispatches, retries or releases a hold. That endpoint may persist its observed
status under the existing authorization model. Failed refreshes retain the
previous record and release the busy state. Late responses from a prior
environment or execution do not replace a newly selected execution.
