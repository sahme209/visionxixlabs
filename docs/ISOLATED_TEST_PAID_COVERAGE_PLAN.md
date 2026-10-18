# Inactive NEW TEST collected coverage — approved implementation plan

Coordinator approved implementation on 2026-10-16. This supersedes the earlier
status-only lifecycle recovery claim. Earlier pinned HTTP evidence remains
historical evidence of status mapping, not proof of collection or renewal.

## Scope and policy

Only exact `axiom_public_test_v1` contracts in the owned loopback fixture qualify.
Original create-attempt proof is necessary identity provenance, never payment
proof. Original price, interval, quantity, customer and subscription stay fixed.
No production model/migration, support path, shared event-consumer semantics,
public route, deployment flag or provider-IO permission changes are authorized.
The existing isolated application flag denies every Stripe boundary absolutely.

Supported paid coverage is full-price USD cash collection for one recurring line
whose own service period is aligned to UTC calendar months: one complete month,
or twelve complete months for annual terms. **Service periods starting/ending mid-month, prorations, partial periods,
discounts (including zero-price), credits,
taxes, manual/out-of-band payments and multi-payment collection are unsupported.**
Calendar alignment constrains service endpoints, not collection time: full cash
collected October 16 for an October 1–November 1 service line is supported.
This bounded inactive proof slice does not complete the hosted payment journey.
Initial binding also requires the original Checkout invoice to remain the current
latest invoice; late first binding after a later renewal is unsupported.

Active paid access requires valid original provenance, immutable collected
evidence and a current observation referencing that evidence, with
`serviceStart <= current clock < serviceEnd`. Missing, unsupported, future or
expired coverage is Unavailable, never Free or legacy fallback. A currently
verified inactive status may retain the existing Free policy only on an
authentically bound, originally collected contract. Missing identity/provenance
is Unavailable regardless of status. No grace or write-off policy is invented.

## Collection and retrieval boundary

Use installed Stripe SDK types, not guessed compatibility fields. Retrieve the
current subscription and latest invoice; match invoice subscription/customer,
one complete non-prorated recurring line, subscription-item/price/product,
original quantity, currency and full expected amount. Coverage comes from the
invoice line's period, not invoice period_start/end. Require finalized paid
invoice, exact cash due/paid, zero remaining/overpaid/balance/credit/discount/tax,
one full paid InvoicePayment linked to a succeeded PaymentIntent and its paid,
captured, unrefunded, undisputed Charge with one identified installed-SDK payment
source. Customer-balance funding, missing/unknown/ambiguous source, and invoice
balance application are unsupported; identified non-card sources use the same
full collection checks. Retain the method type in immutable evidence. Reject payment_record/manual/forgiven/
uncollectible/zero-due/partial outcomes. Reread invoice, charge, subscription and
account before returning; a changed snapshot fails closed. Unsupported current
collection on an established contract clears positive coverage atomically.

At most 14 remote reads, each list limit 2 with has_more false; no pagination.
Zero retries, 10-second maximum per request and 30-second monotonic total
verification deadline. The owned HTTPS transport hard-aborts the request, response
and agent through complete bounded body consumption. It fixes api.stripe.com:443 and requires TLS certificate/hostname verification,
without replacing inherited CA roots or disabling trust. No redirects/retries.
The actual default derives refusal itself when managed proxy or custom trust/
transport settings are present but unsupported: it inspects key presence only,
never values, and fails before socket creation. It does not bypass configured
proxies or alter managed environment. Genuine managed proxy compatibility is
unverified and blocked; inert configuration/native-wire injection is internal
test-only, never selected by public routes or runtime flags. Check
the existing provider denial/runtime/deadline before and after every awaited
SDK boundary; no ambient credentials or actual provider requests in acceptance.
Relevant signed invoice/refund/dispute/credit-note triggers only locate an exact
bound contract; current retrieved state wins over event arrival order.

## Fixture persistence and access

Add fixture-only immutable NewTestPaidInvoiceEvidence and mutable
OrganizationTestCoverageObservation tables (no Prisma schema change). Evidence
records exact scope, invoice/line/payment/intent/charge IDs, cash amounts, service
period and canonical digest. Unique scoped invoice evidence cannot be rewritten.
Projection stores current event token, subscription period/latest invoice, and
collected evidence or explicit negative outcome. Refund/dispute observations
invalidate projection without deleting historical collection evidence.

Coordinator amendment: a verified current subscription with exact original
identity but changed terms produces a typed `unsupported_bound_terms` verdict.
It deprivileges only the separate coverage projection to Unavailable; it adopts
no terms and consumes no event or plan/intent/financial write. Foreign identity
or failed retrieval produces no write. Projection revision is captured before
provider IO and CAS-fenced along with the plan token on every positive/negative
commit; every projection write increments it. Reservation admission also fences
that revision. Thus a late positive cannot overwrite a newer negative merely
because deprivileging leaves the plan token unchanged. Historical replay receipts
grant no authority. A historical event receipt does not discard freshly verified
negative collection: it revision-fences a projection-only replay_unavailable
observation, without rewriting the event/plan/intent or financial rows. Positive
replay never restores that projection. This explicitly supersedes the earlier coverage-free
no-mutation ruling for term drift, and adds no upgrade/downgrade policy.

Reuse the existing subscription event consumer in the same Serializable
transaction as evidence/projection/plan/intent writes. Preserve its opaque token
CAS. Invalid identity/read failure consumes nothing. Reads and previews use one
pure coverage kernel; annual cash funds only its twelve existing UTC monthly
buckets. Existing usage, top-ups, holds and replay receipts remain unchanged.
NEW TEST admission carries an internal guard and conditionally inserts the
existing reservation row against database clock, current event token and month;
replay also revalidates current authority. Legacy reservations retain their
existing path. Expiry alone cannot grant a fresh month even without a webhook.

## RED matrix and execution order

1. Pure kernel RED: monthly/annual collected positive; exact scope and original
   terms; active missing/unsupported/future/expired denied; inactive Free only
   after original collected provenance; mid-month/month-span mismatch denied.
2. SDK RED: active draft/open/uncollectible/forgiven denied; full collection
   chain positive; discount/credit/tax/manual/partial/pagination/foreign-ID,
   refund/dispute and inconsistent reread denied; bounded timeout/read count;
   flag changes at every await prevent subsequent SDK work.
3. Service/store RED: initial binding requires proof; unsupported current state
   replaces positive projection; evidence immutable; duplicate replay,
   out-of-order delivery/current-state retrieval, token race and write rollback
   leave event/projection/plan atomic; financial rows never reset or minted.
4. Resolver/reservation RED: UTC month/year boundaries, expiry without webhook,
   stale preview, month rollover and reused receipt cannot authorize a new
   admission; database-clock/event-token write fence; legacy path unchanged.
   Deterministic races cover negative→stale-positive (same plan token) and
   positive→stale-negative. Terms drift followed by refund and old paid delivery
   cannot retain paid authority or rewrite immutable original collection proof.
5. Focused light tests while coordinator full gates run. Freeze source for
   independent review. Only after explicit granted window run owned PostgreSQL/
   actual Next acceptance and web TypeScript sequentially, then release all
   owned resources. Remote SDK objects are qualified provider fixtures, not
   hosted Stripe proof. Pricing-to-checkout HTTP transport acceptance remains
   deferred until this safety slice is reviewed.

## Historical tracker proposal

Retain old held-row fairness blockers as history, marking pre-LIMIT eligibility,
tenant interleaving and timestamp/CAS rotation superseded by existing source and
tests. Cross-batch starvation/load/backoff remains separate. Do not use this
slice to claim hosted checkout, supported mid-month service periods or general
billing completion.

## Execution record (review candidate)

The initial RED reproduced a $30 active preview with no collection evidence.
The new kernel and collection modules first failed as missing implementations.
Focused source, boundary, legacy-consumer and demo regressions now pass 240 tests
across 11 files (2026-10-16). Eight owned PostgreSQL/Next cases are deliberately
skipped until the coordinator grants an acceptance window. Those cases include
cash recovery, an open/uncollectible invoice, refund invalidation, immutable
evidence, post-evidence-insert rollback, and actual application Unavailable for
unsupported/expired coverage. They are not yet validation evidence for this
candidate. Focused new/changed-source lint and diff whitespace checks pass;
the shared reservation module retains its pre-existing explicit-any signatures.
No compiler, full suite, owned server/database, SDK network call or shared Prisma
generation has run during this implementation window.

Candidate is to be frozen for independent review before owned acceptance and
web TypeScript. Earlier status-only 7/7 HTTP evidence does not validate these
new collection/coverage changes. All remote Stripe objects in current tests are
explicitly synthetic provider fixtures; actual signature construction verifies
only the local signature path. Hosted Stripe acceptance remains a separate gate.

## Bundled independent-review correction

Review of frozen 2f574d8e identified three findings: historical replay discarded
fresh negative collection; Charge funding source was not identified/rejected for
customer balance; socket inactivity was incorrectly described as a hard deadline.
Eleven new source/replay regressions failed before their fixes. Replay now only
deprivileges the revision-fenced projection, never restores positive authority
or rewrites the receipt/plan/intent/financial rows. Explicit replay_unavailable
also prevents old inactive state from becoming an active-unpaid Free fallback.
Known unambiguous non-customer-balance payment-method details are required and
retained in immutable evidence; non-card sources use the same full cash checks.

The owned HTTPS adapter holds a hard timer through bounded complete JSON body
consumption, destroys request/response/per-request agent on all outcomes, and
uses integer remaining time from a monotonic total verification budget. Native
wire tests cover hung headers/body, trickle, shortened remaining time, bounds,
redirect/abort cleanup, managed-configuration refusal, isolation denial and actual
Stripe SDK parsing without retries. They use synthetic native responses and no
network; they do not prove genuine Stripe or managed proxy compatibility.

Calendar alignment restricts invoice-line service endpoints. October 16 full
cash collection for October 1–November 1 is explicitly supported and tested.
Mid-month service endpoints, prorations and unsupported collection sources stay
Unavailable; hosted test checkout and general billing completion remain unproved.

Final bundled candidate focused verification passes 270 tests across 12 files;
8 owned PostgreSQL/Next cases remain deliberately skipped. Focused changed-source
lint passes and whitespace checks are clean. No compiler or owned acceptance has
yet run for this candidate. The deadline owner is propagated by a typed installed-
SDK internal request header, stripped before native HTTPS; active requests are
canceled on expiry, and removed/expired owners forbid delayed SDK request starts
even when asynchronous callback context is lost. Sixteen synthetic native-wire
cases cover whole-body abort/cleanup, absolute/late-start cancellation, managed-
configuration refusal, runtime isolation and actual SDK receipt/error parsing.
This token is cancellation bookkeeping, never an IO permit or request-selected
runtime. Default real transport derives unsupported configuration refusal from
process key presence itself; fixture configuration is available only together
with an explicitly injected synthetic native wire. No managed proxy or trust
values are inspected, logged, changed or bypassed.

## Installed-SDK creation and owned launcher review correction

Scoped financial review of 80007c96 found that installed Stripe's
`additionalHeaders` replaces headers derived from `idempotencyKey`. The actual
SDK with an injected synthetic native HTTPS wire reproduced RED: the outbound
checkout POST had no Idempotency-Key. Creation now explicitly merges the exact
immutable attempt key into additionalHeaders alongside the internal deadline
owner. The actual installed SDK regression proves two low-level identical
attempt calls keep that key and body, strip the internal token before the native
wire, retain the same original response proof, and do not change intent data.
This does not authorize service retries of unknown attempts, which remain denied.

The owned Next child now uses a fixture-only environment builder. It copies
approved inherited proxy/CA selectors opaquely, excludes ambient provider and
application credentials, retains supported heap-only Node options, and refuses
unsupported inherited preloads/guards/trust selectors before spawn without
including values in errors. Known Vitest node/development conditions are harmless
runner options; other CLI options fail closed. Unsupported trust alteration
selectors also refuse launch. Owned DB and application targets remain exact
loopback fixture targets; the absolute provider-denied flag and inert synthetic
AI marker remain mandatory. Fixture temporary font output is removed if launcher
configuration is refused. No managed transport values are logged or modified.

Focused validation passes 317 tests across 15 files, with 8 owned PG/Next cases
still skipped pending review and a coordinator grant. Changed-source lint and
whitespace checks pass. No compiler, owned server/database, real provider call,
shared Prisma generation, hosted checkout or managed-proxy compatibility proof
has run for this correction. Whole-web compilation and exact-source owned
acceptance follow the independent scoped reviews and main integration.

The scoped-reviewed candidate was integrated with main at 579ae03a; whole-web
compilation reported narrowing, Next ProcessEnv augmentation and SDK excess-property errors.
The correction makes never-returning guards explicit function declarations,
retains the runtime Free exclusion before catalog matching, explicitly guards
nullable line details, accepts a readonly partial inherited environment domain,
and binds exact installed RawRequestOptions before the SDK call. No assertion,
suppression or weakened billing check is introduced. A targeted no-emit TypeScript
program including next-env augmentation now exits 0; 317 focused tests pass with
8 owned cases skipped, and changed-source lint/whitespace checks pass. This is
not a whole-web compilation or owned runtime acceptance result.


## Exact Vitest worker launcher correction (2026-10-18)

Whole-web compilation passed at b139ca02. Seven owned PostgreSQL cases passed
on that source; the eighth HTTP case refused launch before Next started because
installed Vitest adds `--experimental-import-meta-resolve` and an explicit
warning preload to its worker. That run does not establish HTTP acceptance for
paid coverage. The previous temporary run log did not survive the execution
environment restart; the earlier reported database outcome stays historical.

The fixture-only launcher now retains the exact built-in option and trusted
warning preload in the child NODE_OPTIONS, rather than dropping either. The
preload is derived from locally installed Vitest, canonicalized by realpath,
matched against the repository-locked 4.1.11 version, and checked against reviewed
source SHA256 `a5012da3d2027007781baecda154d343d8c7ad2327b79bec65b1b60a41f42dd1`.
Any other require/import/loader/guard/trust option, alternate path or modified
framework source/version refuses launch. Existing heap-only handling and known
node/development condition handling are retained. This is an internal test
launcher exception; no production or provider boundary changes.

The actual worker-argv regression reproduced RED before this correction. Now
21 focused launcher cases pass, including a literal local Node child with the
trusted preload actually loaded, the built-in and heap options retained, managed
proxy selector preserved, absolute provider denial true and no Stripe key.
Substituted source/installed-version/lock-version and alternate/extra preload
cases all deny. The subprocess roundtrip passed under narrowly approved local
subprocess access; normal sandbox execution reported EPERM and was not waived.
Targeted no-emit types with Next augmentation, changed-fixture lint and whitespace
checks pass. No whole-web compiler, PostgreSQL or Next acceptance was rerun for
this correction. Freeze and scoped security review precede the next owned run;
hosted Stripe payment and managed proxy compatibility remain unverified.
