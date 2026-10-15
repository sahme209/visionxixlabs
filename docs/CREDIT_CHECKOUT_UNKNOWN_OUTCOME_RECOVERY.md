# AI-credit Checkout unknown-outcome recovery

Reviewed 2026-10-15. Test-mode only; no schema, pricing, entitlement, production
configuration or provider action is authorized by this change.

## Failure closed

A Checkout create request can succeed at Stripe while its response is lost.
Previously the application marked its purchase failed on every helper failure.
That blocked same-key retry and also rejected a later signed paid Checkout
webhook, because credit fulfillment correctly accepts only pending/paid intents.
A timeout is not evidence that no provider session exists.

The helper now reports `not_dispatched` for known failures before the SDK create
boundary (mode, price validation or SDK import) and `unknown` for an exception
or unusable result after dispatch. Only known non-dispatch can mark the unbound
pending purchase failed. Unknown outcomes retain pending intent and the same
purchase ID, key and financial evidence so late verified fulfillment can finish.
The customer response remains sanitized and does not expose provider errors.

## One create authority, bounded eligibility, no invented reconstruction

The route atomically creates the intent under the existing unique
`(organizationId, idempotencyKey)` constraint. Only the invocation whose create
succeeds may contact the Checkout-create API. On duplicate constraint it reads
the existing intent and checks tenant/SKU/status; it does **not** create another
session, even if the existing intent is recent. Concurrent same-key invocations
therefore cannot both dispatch from an ambiguous upsert result.

The existing row stores purchase ID, tenant, key, SKU, price, delivered credits,
validity, period, purchaser/correlation IDs, timestamps and nullable Stripe IDs.
It does not store the complete original provider request: email, display name,
success/cancel URLs and Stripe account identity are absent. Reconstructing those
values from current configuration would not prove equality. Existing pending
intents therefore return HTTP409 `checkout_reconciliation_required`, including
within the conservative eligibility window. This is a deliberate safe limitation,
not automatic provider recovery. No new idempotency key or purchase is generated.

Stripe documents that keys can be removed after they are at least 24 hours old;
reusing a pruned key can execute a new request. A 23-hour conservative bound from
persisted purchase `createdAt` rejects old, invalid or future timestamps before
any create dispatch. This bound is not a claim that old keys are safe, and does
not authorize retries inside it when exact original parameters cannot be proven.
See https://docs.stripe.com/api/idempotent_requests . First dispatch also checks
persisted financial terms against the current catalog and uses the recorded
price. No catalog-change reconciliation or financial rewriting is performed.

Known session recovery/retrieval, operator cancellation, proof of no provider
session, restoring existing historical `failed` intents and any new attempt all
require a separately reviewed reconciliation process. This patch does not
repair historical rows or automatically expire/delete holds. A customer may
need support after a lost response; safe fulfillment is preserved if payment
already occurred and the signed matching webhook arrives.

## Customer interaction contract

The existing add-on button omitted the required Idempotency-Key and expected a
`checkoutUrl` response instead of the server's actual `url`. It now sends a
validated non-secret random intent key retained in sessionStorage under the
workspace/SKU scope, and consumes `url` for the existing redirect mechanism.
Unavailable storage fails before any purchase request rather than silently
losing the reference. Reloads/remounts and uncertain/network responses keep the
same key. The server compares the optional submitted workspace against current
session context before creating an intent; stale workspace UI cannot purchase
against a different active context. Late UI responses cannot redirect after its
workspace/SKU scope changes.

Only a server-confirmed terminal status permits the separate explicit
“Start a new purchase” action to discard the old reference. That action sends no
provider request; the customer must separately initiate the new purchase.
Unknown/reconciliation responses never offer it. Browser storage can still be
cleared externally or a different browser/device can create a distinct intent;
this patch is not cross-device purchase deduplication or automatic reconciliation.
No credentials or Stripe IDs are stored in the browser intent reference.

The add-ons page now passes its resolved workspace, explains the test-mode
approval boundary through ModuleIntro, and displays support guidance for
seat/connector add-ons that the credit-only endpoint does not support. It does
not expand purchasable SKUs or activate billing.

## Regression evidence and limits

`creditCheckoutRecoveryJourney.test.ts` composes actual purchase route, actual
Stripe helper, actual signature verification, actual credit webhook route and
actual fulfillment over simulated SDK/database boundaries. It covers response
loss, same-key recreation denial, late signed paid fulfillment and replay once,
23/24-hour/future/invalid ages, tenant/SKU/financial mismatch, signed mismatched
purchase rejection and known pre-dispatch failure. The composed suite also invokes the actual button → purchase route → helper →
simulated provider response and verifies the required header and actual URL
redirect. Component tests cover reload/reference preservation, storage denial,
explicit terminal-only new intent and workspace scope. Existing route regressions
retain origin, owner and activation boundaries.

The fixture signing secret and test key are invented test-only strings. No real
Stripe endpoint or account is contacted. The in-memory transaction simulator is
not PostgreSQL or actual provider acceptance evidence. Provider-backed Checkout,
financial reconciliation, refunds, subscriptions and invoice collection still
require the isolated, explicitly approved test runtime in
`BILLING_CUSTOMER_JOURNEY_ACCEPTANCE.md`.
