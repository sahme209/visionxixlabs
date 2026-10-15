# Stripe test customer acceptance — proposed operator packet

Prepared 2026-10-15. **Execution approval has not been granted.** This is an
approval-ready scope and evidence checklist, not authorization, a completed
rehearsal, or a request to enable production billing. No secret values belong
in this document, chat, screenshots, command output or a public test report.

## Objective and evidence boundary

Trace one synthetic customer's authenticated subscription Checkout, signed
entitlement, AI request/cost receipt, capped test invoice item, credit purchase,
refund and replay across actual isolated application and provider boundaries.
Existing local regressions are prerequisites; they do not prove actual Checkout,
Stripe delivery, Gateway cost, PostgreSQL concurrency or collected payment.

Use existing routes and components rather than introduce a second billing
implementation. `BILLING_CUSTOMER_JOURNEY_ACCEPTANCE.md`,
`SUBSCRIPTION_EVENT_CONSUMPTION.md`,
`CREDIT_CHECKOUT_UNKNOWN_OUTCOME_RECOVERY.md` and `BILLING_RECONCILIATION.md`
remain authoritative for their implemented contracts and known limitations.

## Required target attestation before execution approval

The operator must privately identify each resource and fill these sanitized
fields. An unset field is a blocker; matching names/schema alone is insufficient.

| Required field | Sanitized attestation to retain |
| --- | --- |
| Application origin and exact source SHA | Non-production target, reviewed commit, auth/application return URLs all point to this target; not a production alias |
| Database binding and schema | Application and maintenance jobs point to the same isolated synthetic database; required auth/billing/event/reservation/settlement tables exist |
| Data boundary | No production customer data; two synthetic tenants and only approved test actors |
| Stripe account/mode | Intended isolated test account confirmed privately; secret key and endpoint are test-only, no live destinations |
| Price mapping | Existing approved Pro monthly recurring per-seat USD price verified against intended test terms; other intervals/plans not included in this first exercise |
| Webhook route | Test endpoint points only to this target's `/api/billing/stripe-webhook`; correct endpoint-specific signing secret configured securely |
| Gateway scope | Approved account/model and bounded real-cost authority; account-level spend control status explicitly recorded |
| Operator and cleanup owner | Authorized operator, approver, execution window, expiry and private evidence location |

Do not use the production founder identity or production account records as test
fixtures. An approved synthetic owner session can be provisioned through the
existing isolated signup/email-proof/pairing flow; if isolated actor setup is
seeded instead, record that signup/native pairing was **not** accepted by this
billing exercise. Email delivery itself requires separately bounded test
recipients and authorization. No externally accessible production clone is
permitted.

Auth-only production repair does not establish all billing tables. The failed
workspace-agent migration still blocks blanket migration history progression.
Initializing this empty isolated database requires an explicitly reviewed
non-production schema/bootstrap procedure; do not run blanket production
`migrate deploy`, reset migration history, or substitute a production URL.

## Minimal secure configuration

Names below are references only. The operator binds values through the isolated
runtime's secure configuration and confirms presence/mode without revealing them.

| Configuration | Proposed isolated setting / purpose |
| --- | --- |
| `DATABASE_URL` | The attested isolated synthetic database only |
| Existing auth/session configuration | Correct isolated origin, secure session secret and approved synthetic actor authentication |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | The same approved isolated application origin for return links |
| `AXIOM_SELF_SERVICE_BILLING_ENABLED` | `true` only for this approved isolated test window; otherwise false/unset |
| `AXIOM_STRIPE_MODE`, `STRIPE_SECRET_KEY` | `test` and corresponding `sk_test_` credential |
| `STRIPE_WEBHOOK_SECRET` | This test endpoint's signing secret, not another endpoint or live secret |
| `STRIPE_PRICE_PRO_MONTHLY` | One approved existing test recurring per-seat price; no Free Stripe price |
| `AXIOM_LIVE_BILLING_APPROVED` | False/unset throughout |
| `AXIOM_AI_USAGE_BILLING_TEST_ENABLED` | `true` only in the isolated test window |
| `CRON_SECRET` | Isolated maintenance authorization; never sent in a browser URL or logged |
| `AI_GATEWAY_MODEL` | A configured, application-recognized, approved Gateway model |
| `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` | Supported secure Gateway authentication, scoped to the approved runtime |
| `AXIOM_AI_MAX_REQUEST_CREDITS_CENTS` | Proposed 10-cent customer reservation for the single bounded AI request; requires compatible approved test allowance |

Minimum synthetic records, written **only after approval**, are accepted
workspace memberships, the resulting test subscription plan/customer, and an
`AIUsageBillingConfig` for the selected tenant with `enabled=true`,
`monthlySpendLimitCents=100`, `currency=usd`. Subscription authority must come
from its signed lifecycle event, not a hand-edited paid plan. The ordinary member
and second tenant serve negative authority tests. Preserve actual webhook,
usage, reservation, settlement and purchase ledgers rather than fabricating
successful receipts or financial outcomes.

The 100-cent customer invoice ceiling and 10-cent request reservation do not
prove a hard ceiling on provider cost. Gateway calls can cost real money even
with Stripe test credentials. Confirm provider-side controls and authorize the
separate proposed **maximum $1 real Gateway spend**, one request, at most 64
output tokens, with no automatic retry. Stop before executing if that cost
boundary cannot be adequately enforced or reviewed. No cloud deployment,
Terraform apply, Airflow execution, production email or scheduled cron is part
of this packet.

## Proposed bounded external actions for explicit approval

The following are proposed limits, not permissions already granted:

- One Pro monthly subscription Checkout and one AI-credit-small Checkout for the
  selected synthetic owner; use Stripe's documented test payment methods only.
  Never enter a real payment card. No creation of live products/prices or
  subscriptions is permitted.
- At most one separately authorized bounded Gateway request. No production
  prompts, customer data, secrets or cloud mutation tools in the prompt.
- At most one AI usage invoice item and one manually finalized/paid test invoice,
  only if the invoice action is separately selected in the approval. Inspect
  whether Stripe's subscription cycle has already included the pending item
  before attaching/finalizing anything; do not create a second invoice or item.
- For the one credit purchase, one partial refund followed by the remainder up
  to its original test payment amount. No subscription or usage-invoice refund
  implementation is implied. Replay only actual existing test events against
  the isolated endpoint; do not forward them to production.
- One test subscription status/seat change and cancellation, with bounded actual
  event redelivery. Additional upgrade/downgrade/annual/Enterprise cases need a
  separate extension to the object/action limits.

Subscription prices and allowance semantics must be approved for this test;
observing existing behavior does not settle public-versus-legacy pricing,
included-credit treatment, grace periods or live collection policy.

## Execution and evidence checklist

| Step | Existing surface and action | Required evidence and stop condition |
| --- | --- | --- |
| 1. Establish owner/session | Existing isolated auth/customer flow | Owner maps to intended synthetic tenant. Member and foreign-tenant negative actors are distinct. Stop on target/identity ambiguity. |
| 2. Subscription Checkout | `POST /api/billing/checkout-session` with `planId=pro`, `billingInterval=monthly`; server counts accepted seats | Verify owner/admin and same-origin enforcement, actual test Checkout URL and server seat quantity. Ordinary member rejected. Checkout redirect alone does not grant access. |
| 3. Signed entitlement | Actual provider delivery to `POST /api/billing/stripe-webhook` | Verify test subscription/customer/organization binding, status, seats, exact signed event consumption and resulting plan. A generic `stripe trigger` fixture without application metadata can be ignored and is not acceptance. |
| 4. Durable replay | Redeliver an actual consumed test event after a later consumed event | Earlier duplicate is a no-op; plan remains at later state. Distinct events now retrieve the established subscription and fence stale responses against its current binding/token; exercise real provider delivery and denied replacement separately. Invalid signature and cross-tenant binding must not grant access. |
| 5. AI request | `POST /api/ai/generate` via approved authenticated surface, small prompt/output and the existing request idempotency header | Retain private request/tenant/reservation/generation linkage. No provider retry or invoice action if generation outcome is unknown. The first test is text-only and performs no deployment. |
| 6. Actual cost receipt | Authorized `POST /api/cron/reconcile-ai-gateway-usage` with isolated Bearer cron secret | Exact captured Gateway generation ID must match provider receipt. Verify provider cents, governed 1.5x ledger amount, any reservation ceiling, and pending/settled state. A temporary not-yet-available receipt remains pending. |
| 7. Test invoice item | Authorized `POST /api/cron/settle-ai-usage` | Inspect actual test invoice-item ID/customer/amount/currency/metadata against the immutable settlement and monthly hold. Re-run same maintenance paths and prove no duplicate item/debit. Spending ceiling blocks additional submission. |
| 8. Optional external invoice acceptance | Separately approved test-only operator invoice action | Verify this exact item is included once, finalized and test-paid; record provider evidence. This is not an automated Axiom collection feature. Failure/unknown outcome retains evidence for reconciliation. |
| 9. Credit purchase | Existing `PurchaseAddOnButton` → `POST /api/billing/add-ons/purchase`, body SKU `ai_credits_small` and workspace; stable `Idempotency-Key` header | Actual URL redirect, exact server price/credits and matching paid signed webhook. Replayed event grants once. Existing uncertain intent is not recreated; support/reconciliation remains required. |
| 10. Credit refund/replay | Actual test credit charge refunds → same signed billing webhook | Cumulative partial/full refund reverses the expected credits; redelivering an older smaller cumulative refund cannot restore revoked credits. Preserve purchase/event evidence. |
| 11. Status and consumer comparison | Signed subscription status/seat/cancellation changes; existing `/control/usage-billing`, desktop billing and quota/seat/AI boundaries | Record each consumer's actual behavior, including inconsistent legacy/identity-only policy. Do not label canceled/past-due access correct until policy is approved. |

Use the existing application paths; do not create a second endpoint, global test
bypass or synthetic provider-success response on a customer surface. The two
maintenance endpoints accept GET as well, but this packet proposes explicit
operator POST calls rather than enabling schedules. Subscriptions/credit
purchases have different authority and refund contracts; do not collapse them.

## Script and implementation exclusions

**Do not execute `scripts/sync-stripe-pricing.mjs` for this exercise.** It accepts
live keys, creates fresh products/prices/payment links on every run and embeds
legacy Starter/Growth/Scale terms. It is not a replay-safe public Pro/Enterprise
acceptance fixture. Select verified pre-existing test prices or approve a
separate bounded test-price provisioning procedure.

The existing `.github/workflows/auth-recovery-rehearsal.yml` and
`scripts/rehearse-auth-recovery.mjs` test authentication schema recovery; they
are not Stripe acceptance automation. No dedicated provider-backed Stripe
acceptance script currently closes this journey.

Current AI settlement creates invoice items only. It does not finalize an
invoice, collect payment, reconcile `invoice.paid`/`invoice.payment_failed`,
issue usage-invoice credit notes or implement usage-invoice refunds. These are
independent engineering/policy gaps. Established-subscription reconciliation now retrieves current provider state and
fences stale responses against the local binding/token; see
`SUBSCRIPTION_AUTHORITATIVE_RECONCILIATION.md`. Actual provider acceptance and
authorized replacement remain open. Desktop commercial access is currently a
separate identity-only policy, while resource and AI quota consumers retain
other existing rules. No policy is silently changed by this acceptance packet.

## Abort, evidence and cleanup

Abort before further actions on live mode, an unexpected account/target,
production data, missing schema, uncontrolled spend, mismatched amount/tenant,
provider ambiguity or an unrecognized financial outcome. Preserve pending
purchases, settlement reservations and event evidence; age alone is not proof
that Stripe did nothing. Never reset keys, release holds, edit financial rows
or resend old create requests to make a test appear successful.

Retain sanitized pass/fail per step, source SHA, mode/target attestations,
operator approval reference, timestamps and private evidence references. Keep
provider/customer/purchase identifiers and account records in the restricted
evidence store; public summaries omit them. No secrets in artifacts.

Cleanup is separately included in the explicit approval: cancel the synthetic
test subscription after its evidence is retained, remove/disable the isolated
webhook destination, revert isolated opt-in flags, stop Gateway/maintenance
activity, and expire approved disposable resources only after preserving the
required audit evidence. No destructive database cleanup, provider refund or
resource deletion is implied beyond that approved scope. No live or production
resource is touched.

## Gate to request execution approval

Record all target/config attestations, the approved synthetic-data/bootstrap
procedure, exact allowed objects/actions/caps, isolated runtime owner, evidence
location, expiry and cleanup owner. Resolve any mandatory preflight mismatch.
Then present that completed concrete packet for explicit approval. Until then,
status is **prepared, execution blocked; no authorization granted**.
