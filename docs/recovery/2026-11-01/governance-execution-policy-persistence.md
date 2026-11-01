# Local reviewed execution-policy persistence

The user approved implementing the local persistent policy design. This increment
creates the numeric authority issuer and current reader using existing durable
workflow/event tables. It introduces no schema, migration, production activation,
provider I/O, grant, purchase or human decision.

## Actual implementation

`executionPolicyStore.ts` stores immutable, strictly validated revisions binding
organization, exact scope, numeric level 0–5, permitted governed actions, explicit
executor user IDs, expiry and parent policy digest. Their typed workflow kind is
separate from baseline revisions, baseline enrollment and scheduling charters.
Missing state is never an inferred default. Runtime lifecycle metadata remains
`observe`; the authority reader reads only the reviewed policy's numeric field.

Proposal requires current policy administration. Approval requires a separate
current reviewer, excludes both proposer and every permitted executor, and binds
the immutable policy digest. Activation requires current administration, current
requester/reviewer roles and sessions, a genuine approved revision, exact parent
and expected active-pointer version. Organization advisory locking and versioned
compare-and-set updates serialize competing activation. Revocation preserves the
immutable input and appends history; it makes current reads refuse immediately.
DB-clock expiry is checked as well as application time.

All four mutations use bounded primary-key durable request markers. A request
nonce is organization-wide, bound to operation, exact arguments, caller and
session. Marker, immutable result snapshot, audit and mutation commit atomically
under the organization lock. Changed input, another revision, another operation,
another caller/session or a damaged receipt refuses. Exact recovery returns the
original inert saved result; it does not reissue authority. Thus recovering an
old activation response after revocation cannot make current authority succeed.
No history scan or backfill is used to deduplicate requests.

Revision, pointer and request audit receipts validate exact immutable input and
state hashes, contiguous sequence/version, previous-state chain, actor/session,
nonce, transition type and timestamp. Current reads require exact organization,
scope, permitted action/executor, live expiry, approved non-revoked revision,
current original requester/reviewer/activator roles and sessions, correct active
pointer and optional expected policy digest. They return stored limits and
`executionAuthorized:false`: baseline, action, provider and coverage checks remain
independently required.

`executionPolicyRequestService.ts` composes the real existing paired request
authority and current locked membership/session reads. It never adopts another
principal's session. Feature-disabled, changed caller, changed recorded role and
revoked recorded session refuse. `requestService.ts` exposes this composition as
`executionPolicies`. No public route or native authoring UI was mounted, and no
executor dispatch was connected to it in this increment.

## Verification and review correction

- Seven policy-store unit checks cover independent review, exact inputs,
  action/scope/executor/tenant refusal, expiry, revocation, corruption, CAS,
  replacement, exact recovery, nonce reuse and damaged durable receipts.
- Three request-composition checks exercise its actual authority callback with
  simulated paired authority, membership/session responses and store methods.
- Four tests passed on a newly owned socket-only PostgreSQL17 fixture using the
  actual policy store and request composition. Durable rows/events, transactions,
  advisory serialization, competing CAS, recorded member/session reads and
  database clock were real. Paired requester authority was explicitly simulated;
  no external provider was involved. Cases cover complete lifecycle/recovery,
  scope/action refusal, competing replacements, changed reviewer role/session,
  expired proposal and nonce reuse across revisions/operations. The fixture was
  stopped in `finally` after every run.
- Independent parent review identified that digest-keyed proposals alone did not
  prevent a nonce being reused with changed input. A regression reproduced the
  incorrect success before durable request markers were added; it now refuses.
  The actual PostgreSQL suite includes the corrected nonce journeys.
- Full local Intelligence suite after corrections: 190 passed, 20 database
  dependent skipped. The four policy PostgreSQL tests were then run explicitly
  and passed; the other database skips are not acceptance claims.
- Production TypeScript for the store, new request composition and edited main
  request service passes with the locked dependency overlay. An independent
  current-source archive stage also passed after the nonce correction using the
  locked SDK overlay. `git diff --check` passes. Independent parent re-review
  accepted the corrected scoped source with no new important issue.

The first owned fixture setup failed at Prisma client discovery and stopped;
temporary package discovery and automatic-install refusal were corrected before
the successful fresh fixtures. Only temporary fixture schema/client files were
created. No repository schema or dependency change was made.

## Remaining integration gates

The numeric authority issuer now exists locally. It is not mounted as a customer
workflow and is not yet supplied to actual merge admission. Trusted merge action
authority must join this current policy digest to stored operation/scope, fresh
baseline source receipts, current provider/platform authority and actual
baseline-bound independent provider approval. Any policy replacement/revocation
between claim and write must invalidate the original receipt. Do not turn a
policy read into provider access, rollback proof or an action approval.

Default activation/enrollment still refuses because executor coverage is not
complete. All required mutation paths need actual admission at claim and final
transport, verified coverage, real-store journeys, independent review and native
workflow verification before enrollment may be offered. Existing scheduling
charters and workflow row metadata remain insufficient authority. No full-MVP,
production enforcement or live execution acceptance is claimed.
