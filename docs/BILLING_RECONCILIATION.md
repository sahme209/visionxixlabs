# Billing reconciliation boundary

Status: review-only. Self-service checkout must remain disabled until every activation item below is complete and explicitly approved.

## Current authorities

| Concern | Current implementation | Authority today | Decision for the new model |
|---|---|---|---|
| Customer-facing proposal | `lib/billing/publicPlanCatalog.ts` | Display only | Free, Pro, and Enterprise remain a proposal until activation |
| Organization subscription | `TenantBillingPlan` through `lib/billing/tenantBillingStore.ts` | Preferred commercial authority | Keep as the single organization-level source of truth |
| Organization webhook | `POST /api/billing/stripe-webhook` | Signature-verified, metadata-scoped, idempotent | Retain and extend only after public-plan mapping is approved |
| Legacy user subscription | `User.plan` through `POST /api/webhooks/stripe` | Legacy compatibility path | Migrate existing customers before retiring; never silently remap |
| Legacy feature catalog | `lib/billing/tierCatalog.ts` | Used by existing platform limits | Replace with organization entitlements through an explicit migration |
| Legacy pricing registry | `lib/billing/planRegistry.ts` | Internal historical pricing and AI limits | Do not expose as the new public pricing model |
| Checkout | Two existing checkout routes | Disabled by default | Requires `AXIOM_SELF_SERVICE_BILLING_ENABLED=true`; keep false until approval |

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

## Required activation sequence

1. Approve the public prices, 20% annual discount, deployment allowances, and AI-credit economics.
2. Add immutable public plan identifiers and versioned Stripe price mappings to the organization billing path.
3. Define a migration from legacy `User.plan` rows and existing Stripe subscriptions to `TenantBillingPlan`; produce a dry-run report before writing data.
4. Make seat and deployment counters organization-scoped, transactional, and idempotent under concurrent dispatches.
5. Count only after provider dispatch succeeds and bind the count to the dispatch idempotency key.
6. Cover upgrades, downgrades, renewals, cancellation, past-due state, refunds, and webhook re-delivery in integration tests.
7. Verify the same entitlement response is consumed by the website, desktop app, and every mutating API boundary.
8. Create or reconcile versioned Free, Pro, and Enterprise products and prices in Stripe test mode only.
9. Run Stripe test-mode customer journeys and reconcile invoices, seats, usage, and webhook state.
10. Obtain explicit approval before setting `AXIOM_SELF_SERVICE_BILLING_ENABLED=true` or creating live prices.

## Fail-closed rules

- A marketing page never grants an entitlement.
- A checkout redirect never grants an entitlement.
- Unknown plan, price, organization, or webhook metadata is ignored or rejected rather than guessed.
- Fundamental approval, audit, and production-safety controls are never removed because of plan state.
- Existing subscriptions are preserved until their migration is individually reconciled.
