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

Checkout metadata records only `organizationId`, public `planId`, interval,
and server-counted seats. A successful redirect never grants access. The signed
`customer.subscription.created|updated|deleted` lifecycle is authoritative.

## Required activation sequence

1. Approve the public prices, 20% annual discount, deployment allowances, and AI-credit economics.
2. Review the implemented immutable public plan identifiers and monthly/annual Stripe price mappings on the organization billing path.
3. Define a migration from legacy `User.plan` rows and existing Stripe subscriptions to `TenantBillingPlan`; produce a dry-run report before writing data.
4. **Deployment and seat concurrency complete.** Deployment dispatch reserves an organization allowance slot in a serializable transaction and binds it to a unique organization/idempotency key. Invite acceptance and enterprise SSO now claim accepted seats transactionally; paid plans fail closed unless the signed Stripe subscription supplies a positive seat quantity. Legacy-plan migration and Stripe test-mode reconciliation remain below.
5. **Implemented for AWS ECS desktop and Agent dispatch.** Active reservations temporarily consume a slot; failed provider dispatches release it, accepted dispatches settle the same durable execution row, stale reservations expire, and exact retries replay the prior execution without dispatching twice.
6. Cover upgrades, downgrades, renewals, cancellation, past-due state, refunds, and webhook re-delivery in integration tests.
7. Verify the same entitlement response is consumed by the website, desktop app, and every mutating API boundary.
8. Create or reconcile versioned Pro and Enterprise recurring per-seat prices in Stripe test mode only; Free has no Stripe price.
9. Run Stripe test-mode customer journeys and reconcile invoices, seats, usage, and webhook state.
10. Obtain explicit approval before setting `AXIOM_SELF_SERVICE_BILLING_ENABLED=true` or creating live prices.

## Fail-closed rules

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
