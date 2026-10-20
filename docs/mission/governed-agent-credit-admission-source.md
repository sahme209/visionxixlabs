# Governed Agent extraction: durable admission source checkpoint

Scope: source changes and inert regression tests only. This is not evidence of
a paid model call, successful customer journey, production schema readiness, or
approval to change production. No schema, migration, pricing, enrollment, secret,
infrastructure, or deployment change is included.

## Existing ledger and trusted admission

- The existing desktop session supplies `userId`; request-body actor/organization
  values cannot authorize billing. The actor follows the existing decision loop
  to its single governed extraction boundary.
- Every actual extraction, including each bounded repair, calls the existing
  serializable reservation admission. A SHA-256 key domain-separates organization,
  authenticated actor, and exact iteration/repair correlation. Raw correlation
  punctuation is not used as an invalid ledger key.
- Reused holds never authorize dispatch. New legacy holds transition atomically
  from unexpired/unattached `reserved` to `dispatch_unknown` under a locked,
  currently accepted membership and the database clock. Legacy membership is not
  changed to an owner/admin requirement. Isolated anniversary-v2 holds retain
  their existing, stricter claim and provenance checks.
- Legacy capacity calculation now includes `dispatch_unknown` without a TTL
  exemption. Only never-claimed `reserved` holds can expire or be released by the
  existing generic release operation. An uncertain SDK outcome cannot restore
  spending capacity merely because five minutes elapsed.
- A one-use, process-private WeakMap capability is minted only after the claim
  transaction commits. Manager scope mismatch, forgery, serialization/copy, and
  reuse cannot dispatch. There is no public `skipUsage` switch, unmetered callback,
  new ledger, or synthetic billing receipt.

## Single attempt and singular accounting

- The admitted manager path requires one Gateway provider and consumes its
  capability before SDK dispatch. Its Gateway text-envelope lane sets SDK
  `maxRetries: 0`; a single configured provider alone would not disable the SDK's
  hidden default retries. Output is explicitly bounded by the existing generation
  maximum of 4096 tokens. Invalid admitted bounds fail before dispatch.
- The existing usage producer writes a successful paid envelope before JSON
  parsing. Invalid JSON therefore retains its metering identifier and accounting;
  repair requires another independently admitted hold. No generic parsing/SDK/
  missing-usage/write failure releases claimed capacity or authorizes replay.
- Anniversary-v2 uses its existing attributed writer. Legacy Gateway usage uses
  the existing producer in the same serializable transaction as hold linkage,
  with its upsert operation restricted to unique CREATE. Any pre-existing
  generation, including an unbound or billed same-tenant generation, is refused.
  A concurrent duplicate CREATE also fails instead of acquiring another call's
  generation. Only the exact owned `dispatch_unknown`/unlinked hold is linked to
  the newly created event and changed to `pending_settlement`.
- Ordinary provider-manager extraction retains its existing eager usage writer
  and ordinary SDK retry behavior. The new admitted lane does not write eager
  usage and then write a second event. Existing Gateway reconciliation remains
  responsible for authoritative cost and bounded settlement.

## Limits and remaining acceptance

The unchanged request reservation defaults to **1000 cents**, with the existing
reviewed environment override range of 1–10000 cents. Legacy Starter has a
2500-cent allowance. New isolated public-catalog Free has only 200 cents and must
refuse this default reservation unless a separately reviewed isolated test
configuration lowers the request bound. No pricing or production configuration
is silently changed to make a test pass. These source tests do not accept the
new Free customer journey.

An output-token bound and a fixed monetary hold do not prove model-specific
provider-cost coverage. Actual Gateway pricing, reasoning costs, cost lookup,
reconciliation, anniversary-v2 test provenance, and application-level financial
acceptance still require the existing isolated validation gates. Missing SDK
generation/usage or a failed post-dispatch transaction leaves an uncertain hold
that needs authoritative reconciliation; generic errors are not proof of zero
provider cost. No production repair or release of such holds is authorized here.

Tests cover trusted actor propagation; per-iteration/repair admission keys;
replay/forgery/foreign-scope denial; immutable authority; atomic legacy claim
predicates; uncertain capacity after expiry; one SDK attempt with zero SDK retries;
bounded output; successful envelope accounting before parse; exclusive v2 writer;
foreign/prior generation refusal; and fail-closed missing usage/write outcomes.
SQL-boundary tests use controlled fakes, not a live database or concurrency proof.

Follow-on: the generic generation route's legacy lane still has its historical
release-on-uncertain handling and ordinary SDK retry behavior. Only its existing
reservation/output constants are shared here; its accounting is not refactored.
This checkpoint must not be reported as fixing admission for every AI lane.

