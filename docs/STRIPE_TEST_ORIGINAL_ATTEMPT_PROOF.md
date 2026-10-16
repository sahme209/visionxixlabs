# Inactive Stripe TEST original-attempt proof

This internal source adapter is **not connected to any application route**. No
Stripe account, key, price, provider deployment or production database was used.
It does not enable billing or establish hosted Checkout/payment acceptance.

## Existing boundaries reused

`newTestSubscription/service.ts` still owns prepare/attempt/reconciliation;
`postgresFixtureStore.ts` still uses the same intent JSON, Serializable CAS,
TenantBillingPlan and durable StripeBillingEvent consumer. There is no new ledger,
Prisma model, migration, pricing change or User.plan promotion. Legacy subscription
helpers, customers and support checkout/webhook source are untouched.

The adapter factory takes explicit TEST credentials and the isolated store; it
never reads ambient keys or falls back to a live client. The existing isolated
application provider-denial flag blocks construction and every IO boundary; this
adapter does not activate Stripe inside that application lane. Its only default SDK
client has a ten-second per-request timeout and zero SDK retries. Canonical
create bytes are bounded to 16 KiB, raw webhook bytes to 256 KiB and signature bytes
to 4 KiB before parse/crypto/SDK. Constructor configuration is snapshotted; store
runtime drift fails closed. The installed
SDK version determines its API version. A current-account read must equal the
frozen account before/after create; prices, products, sessions and signed events
must be test mode, and current catalog/quantity/price/product shape must match.

Before the original create, current accepted manager, accepted seat count and
exact attempted intent are rechecked after account/price IO. This is a local
recheck, not atomic revocation with an external provider. After create, the
receipt/session are persisted even if authority changes; current manager/seats
are rechecked before returning any URL. A binding appearing during provider
reads prevents create; a foreign binding after receipt capture denies URL while
preserving proof. Only the exact same bound intent/contract identity may be
recognized as its own concurrent fulfillment. Revocation never discards a received
original receipt or grants an entitlement.

## Original proof and uncertainty

The original outbound canonical bytes/key are recorded distinctly from observed
SDK response headers. The proof includes runtime/account/session, SHA-256 digest,
outbound idempotency key, nonempty SDK request ID and integer 2xx status. Optional
response idempotency/account/API-version headers remain optional observations;
contradictions reject the response. Missing headers are never invented. Account
identity is independently checked rather than inferred from an optional header.

Proof and confirmed session commit together at the existing expected intent
revision before URL release. The owned test fixture trigger permits proof capture
only once in attempted→session_confirmed and freezes it thereafter. This is
fixture-only DDL, not a production migration proposal or schema execution.

A failed/uncertain storage operation returns reconciliation_required, retaining
the durable attempted/unknown fence (or an already-committed receipt). No new key,
automatic retry, event consumption or financial grant follows. Initial adapter
scope supports checkout.session.completed only. Metadata is only an intent lookup
hint: a valid signature and matching metadata are insufficient without previously
captured exact session proof. Proofless response-lost late events stay unknown.
No event metadata or freshly reconstructed request can supply original proof.
If the account read after provider creation fails, no original proof is returned:
the intent stays unknown, with no URL, grant or retry; automatic recovery is not
inferred from that uncertainty.

The existing generic ProviderBoundary remains a trusted fixture port: older
synthetic late-binding tests intentionally model independently supplied trusted
attempt evidence. They do not establish that actual Stripe emitted that proof.
The actual SDK adapter applies its stricter persisted-proof requirement.

## Verification and remaining acceptance

Local SDK fixtures exercise captured response, missing/contradictory optional
headers, account/identity mismatch, strict proof shape, role revocation before
create and after response, storage rollback, and exactly-once late fulfillment.
The positive webhook uses the actual Stripe SDK local signature verifier with
synthetic fixture payload/secret; all remote retrieval/create calls are mocked.
The owned PostgreSQL17 fixture exercises actual full application schema,
intent proof CAS and trigger rewrite rejection. No hosted Stripe, actual payment,
renewal/change lifecycle or positive generation evidence is claimed.

Activation remains unapproved. Actual secure TEST account access, reviewed
endpoint-specific webhook configuration, configured test prices, approved owned
runtime and hosted customer acceptance are still required. Renewal/replacement,
proofless recovery and broader operational policy need separate review.

Local focused validation: final SDK/service proof and existing contract kernels
passed 51 tests, including the existing isolated-mode zero-SDK guard. The final
owned PostgreSQL suite passed 5 tests (one HTTP case intentionally skipped).
The combined focused run passed 56 tests in 9.48s; the later strengthened guard
assertions passed the same 51 SDK/kernel tests separately. Focused changed-source
lint and web TypeScript passed. Independent read-only review found no remaining
material blocker within this inactive scope. Full regression and exact-head CI
remain coordinator integration gates. These counts do not represent hosted
customer workflows.
