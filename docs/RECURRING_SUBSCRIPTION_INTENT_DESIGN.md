# Recurring subscription intent and uncertain-outcome recovery proposal

Source: main PR147 `cca52dfb`, `stripeHelper.createCheckoutSession`, canonical
Checkout route and authoritative subscription consumer. **Review-only design;
not implemented, no schema or provider action authorized.** Prepaid credit
Checkout recovery is already implemented separately and must not be duplicated.

## Existing failure boundary

Recurring Checkout has neither durable local purchase identity nor Stripe
idempotency key. Provider creation followed by lost response is reported as a
failure; another click can create a second session/subscription. The established
subscription consumer then correctly refuses unexpected replacements, but that
refusal cannot prevent a duplicate external subscription from charging. The
client's workspace fence solves a different issue and is not deduplication.

## Proposed minimum coherent contract

Use a distinct durable recurring-intent record, not AddOnPurchase. Proposed
fields: opaque id; organization; initiating accepted user; client intent key;
contract/version reference; plan and billing interval; configured Stripe price
identity; authoritative seat quantity; currency and verified price snapshot;
exact original provider request snapshot (including return URLs and any customer
reference/email); snapshot digest; stable provider key; created/updated times;
provider-attempt timestamp; state; provider checkout session/subscription/customer
identities when known; sanitized reconciliation outcome. Unique organization +
client key; provider session identity unique when present. Never store API keys or
raw provider errors in this record. PII in request snapshot needs the repository's
existing restricted-storage/retention policy, not logging.

1. Under current same-origin/activation/mode/current manager checks, validate
   expected workspace and client intent. In a Serializable transaction capture
   server-controlled financial/request terms and reject active established
   subscription or another unresolved purchase intent. Same key + same request
   returns that intent; changed terms conflict, never overwrite.
2. Commit the durable intent before any provider dispatch. A single durable
   attempt claim prevents concurrent callers from creating separately. Send the
   exact frozen request with the same durable Stripe key, bounded timeout and no
   speculative SDK retries. Store confirmed provider session/url atomically.
3. Once dispatch might have happened, retain uncertain state. Do not mark failed,
   release intent ownership, rotate the key or create another purchase. Database
   commit uncertainty after provider success is also unresolved, not safe retry.
4. Retry only if the complete original request is reconstructible and still
   within a conservative window measured from original creation, never extended
   by attempts. Stripe may prune idempotency keys after at least24hours; old keys
   are not proof of deduplication. The exact allowed retry policy and expiry
   margin require review. Otherwise use provider reconciliation/operator review,
   not automatic redispatch. Session expiration alone is insufficient if a
   completed subscription may exist.
5. Late signed events correlate via durable intent metadata plus exact
   tenant/customer/session/subscription/mode/terms checks. Preserve current
   authoritative provider retrieval, durable replay and equality fence. Linking
   a new subscription is initial activation only; it does not authorize replacing
   an established binding. Unknown or conflicting provider state remains held.
6. A fresh purchase is allowed only after verified terminal reconciliation says
   the prior intent cannot create an active subscription, or an explicit reviewed
   replacement operation establishes that authority. Browser reload/new tab/device
   must not evade the organization's unresolved-intent guard.

Never infer ordering from event.created or lexical event IDs. Existing established
subscription reconciliation remains authoritative. Do not make canceled customer
replacement an accidental consequence of a new intent key. Upgrade/downgrade,
proration, grace periods and migration of existing subscribers are separate
commercial decisions; no defaults are invented in this design.

## Required composed regressions before adoption

Real route→intent repository→provider boundary with provider simulated: same-key
concurrency dispatches once; separate-key concurrent organization intents do not
duplicate; changed org/price/quantity/interval rejects; response lost then late
signed fulfillment activates once; replay after newer subscription state no-ops;
post-dispatch local write/commit uncertainty stays held; original-key retry uses
byte-equivalent financial parameters; expired/invalid-createdAt or missing
snapshot never redispatches; unrelated customer/subscription conflicts roll back;
existing subscribed workspace cannot create replacement; explicit terminal close
allows a fresh reviewed intent; current role removal before admission blocks.
Run actual PostgreSQL isolation/constraints with synthetic data after schema
review. Provider-simulated tests do not prove Stripe account configuration,
retention behavior, real checkout payment, invoices or cancellation.

## Approval/dependency boundary

First review schema, request snapshot retention, organization-wide purchase
ownership and recovery state machine. The change can be built locally while
activation remains disabled; any production migration requires separate explicit
approval and recovery readiness. No live Stripe, existing-price mutation,
commercial term change or production backfill is included. The user has authorized Stripe TEST validation; execution still requires the
already documented isolated acceptance packet and securely available test
account/runtime. This design grants no production or live-billing authority.
