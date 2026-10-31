# Governance Intelligence — local foundations

This package is not an active customer enforcement feature. A new local read-only route is disabled by default and not deployed; no executor imports the admission guard. It grants no execution authority. Local design/implementation approval does not activate it.

Implemented locally:
- Strict tenant-bound evidence and immutable baseline contracts; closed supported fact/action types and deterministic generic-engine adapter.
- Read-only fixed-operation collection ports with pagination, deadlines, cancellation and explicit partial/denied results. GitHub fixed-GET request composition now binds existing paired principals, current memberships and tenant installations; it is not mounted or enabled. AWS composition remains pending.
- Bounded UTF-8 text/Markdown requirement extraction with exact known clauses, source hashes and line citations; unsupported prose stays unresolved. No model calls.
- Immutable revision records, independent approvals, atomic active-scope pointers, revocation and hash-linked audit history using existing durable workflow tables. Actual isolated PostgreSQL journeys cover races and stale authority. No schema migration.
- A two-phase admission guard with exact context/revision binding. It is not connected to existing executors. Enrollment refuses when trusted execution coverage is missing.

Remaining before an MVP can be called complete:
1. Bind real existing organization-scoped connections, source authorization and immutable evidence artifacts; current-source freshness proofs must support unchanged approved sources without forcing approval every five minutes.
2. Register and wire verified coverage for every mutation in an enrolled scope across Agent, Repositories, Bot, deployments and integrations; unavailable paths must refuse. Keep existing approvals and one-attempt guards.
3. Add drift reporting and the integrated source/proposal/approval/decision workflow in existing native/web governance views.
4. Complete isolated composed journeys, full builds, final independent review and specifically authorized activation/live acceptance.

Boolean/marker-shaped inputs to pure kernels are server facts, not client authority. The server composition must load current evidence, coverage, approvals and roles from trusted stores. Never expose these pure functions as an endpoint that accepts authority flags.

Local guard reliability repair: a single 15-second abort deadline now bounds authority reads; caller cancellation is propagated and the prior claim receipt is checked again after write validation. Six guard checks and scoped backend types pass; focused independent review found no Important/Critical issues. This does not add executor wiring or activate Governance.

Current local composition increment:
- Historical revision display checks current reader authority while preserving stale-source history; decisions still require fresh evidence. One actual isolated PostgreSQL regression passed.
- Baseline service warms request-local evidence outside locks before propose/review/activation. Three tests passed; store-level independent review and coverage checks remain mandatory.
- Request authority uses existing paired sessions, commercial access and locked current membership/session reads. Collector/policy administration requires policy:manage; independent reviewers retain agent:approve without administration. Three tests passed.
- GitHub collection request composition uses fixed organization-bound installation reads and rechecks source revision at durable save. Three composition tests passed with simulated provider/token/store ports, not live discovery.
- Desktop frontend build/types, scoped Governance types and changed web Governance page types passed. Full activation, live acceptance and final whole-MVP review remain pending.

## AWS and drift increment (local only)

AWS discovery now composes with the existing tenant/vault broker and exact STS identity verification. Fixed SDK reads list IAM role metadata, customer-managed-policy default-version metadata, and regional EC2 instance metadata. Temporary credentials remain in the broker stack; clients use bounded handlers, single attempts and cancellation. No grant, deployment or live AWS call occurred. Policy documents/trust bodies/addresses are not retained, and metadata does not establish effective IAM permissions or public exposure. Unavailable IAM permissions remain unknown; they are never retried or treated as a missing control.

Evidence now records the exact collection operation profile. Fresh revalidation repeats that profile, without saving a new artifact. Older snapshots remain readable but missing profiles cannot manufacture new provider reads. Existing reviewer read capabilities can revalidate; administrator collection rights are not granted to reviewers. Durable connection/vault revision checks still gate new artifact saves.

Read-only drift reports compare canonical approved history to separate fresh sources, with citations and changed/unchanged/unknown results. Denial/partial data remain unknown; cancellation refuses the report. This grants no remediation or execution authority. Final source expiry is checked again before returning the report.

Validation: 80-test local Governance/broker batch passed (8 isolated-PG tests intentionally skipped there), followed by five focused AWS projection tests after partition/resource-kind tightening. One actual isolated PostgreSQL artifact journey passed with recorded collection operations (two unrelated tests skipped). Ten native-panel component tests passed; Governance/desktop types and frontend build passed. Provider data in tests is simulated. New UI groups long association audit bindings in a disclosure while keeping exact site, ticket, request versions, repository, source and run visible; approval/uncertainty guards are unchanged. Not opened in the signed running apps or deployed.

Still incomplete: baseline/drift HTTP and native/web workflow composition, complete registered executor coverage and end-to-end enforcement journeys/final review/activation. Collector factories remain unmounted and disabled by callers. No universal enforcement or live AWS acceptance claim.

Shared locked source binding now rechecks exact GitHub installation or AWS account/vault revisions before artifact saves, and is reusable by baseline preflight. It grants neither principal authorization nor freshness proof. Four direct regressions and both request-composition suites passed (12 tests total); scoped production types passed. Current document-head authority remains explicitly unavailable rather than invented. Full baseline-store/source request composition is still pending.

## Request-bound baseline composition

`requestService.ts` now composes current paired authority, immutable artifact/revision stores, exact read-only source rechecks, request-local preflight and drift. Another recorded principal is checked through their current accepted role, never by adopting their session or making a decision on their behalf. Collection requires policy administration; source revalidation uses existing reader capabilities. Activation explicitly refuses because actual executor coverage remains unregistered.

One composed journey passed on owned socket-only isolated PostgreSQL: artifact collection, immutable proposal, self-approval refusal, separate reviewer approval, unchanged/changed/unknown drift, no active scope, and refusal to reuse an approval after reviewer-role removal. Durable stores, memberships and audit records are real PostgreSQL; paired-session/commercial authorization and provider responses are simulated. A connection-local temporary GitHubInstallation fixture was used because the narrow fixture database has no production installation table. No production/customer database or provider call occurred. Scoped production types passed. HTTP/client/native workflow and enforcement remain unfinished.

## Read-only HTTP and native prototype

The local POST `/api/desktop/governance-intelligence/read` accepts only list_evidence, read_revision and read_drift. Paired workspace authority, strict 2 KiB input, rate limiting, total cancellation and bounded private responses apply. Approval, collection, activation, revocation and provider writes are not reachable from this dispatcher. The route defaults OFF unless the separately authorized future setting AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED is explicitly enabled. No setting was created or changed and no deployment occurred.

Desktop DTO/client checks bind exact revision and baseline digest, reject execution claims and malformed current-source reports, preserve account-change cancellation and make no automatic retries. The existing transport now allows only this exact read path; failed reads do not masquerade as uncertain provider writes. Existing release/ticket transport behavior remains unchanged.

GovernanceEvidenceView is a local read-only prototype and is NOT registered as a customer destination. It performs no automatic reads, shows source gaps, saved baseline/rule details and historical/current drift, and never offers an independent approval or activation control. Old drift remains historical after a failed source check even if an unrelated metadata reload succeeds. Editing the selected baseline clears its prior display; changed-account responses are ignored.

Validation: 34 HTTP/DTO/client/view and existing release/ticket client checks passed; scoped production types including the new route, desktop types and frontend build passed. No signed app build/open, visual/native acceptance, customer read, schema/settings change, CI or deployment. Proposal/approval UI, document-head freshness, complete enforcement coverage, final review and live acceptance are still incomplete.

## Exact review HTTP and desktop component (local, disabled)

The separate POST `/api/desktop/governance-intelligence/review` dispatches only
propose, approve and revoke. It rejects supplied identities/authority fields,
binds proposal organization to the paired principal, requires existing review
or policy-management capabilities, limits input to 64 KiB, and preserves the
store's exact-version, independent-actor and fresh-source checks. No activation,
collector or provider-write operation is available. The existing Governance
flag remains OFF/unmodified; neither route is deployed.

Desktop approve/revoke methods validate exact returned revision, digest/status
and version. Lost durable acknowledgements remain unconfirmed even on HTTP409;
there is no automatic resend. A standalone local GovernanceReviewPanel requires
a deliberate exact-evidence checkbox, blocks self-approval, ignores account
changes, and holds all failed decisions until saved history is deliberately
reloaded. It is not registered/mounted in the running native app. The existing
read-only evidence prototype remains read-only. Proposal authoring and the
complete integrated customer workflow remain unfinished.

Validation: six review HTTP checks, 15 combined Governance/ticket client checks
and five review-panel checks passed. Scoped server types (including both routes),
desktop types and frontend build passed. The new unmounted panel is covered by
component tests/types, not native visual acceptance or the current application
bundle. No actual approval, provider access, setting, deployment or schema
change was made by this local implementation. Final whole-MVP review and full
production build remain pending.

## Saved baseline selection (local)

The read dispatcher now supports list_revisions. Request composition rechecks
the current workspace reader before and after a bounded organization-scoped
query; each returned revision passes the existing immutable history and current
reader checks. Only metadata for the latest 20 revisions is returned, with an
explicit truncation marker. No fresh provider read or approval occurs merely by
listing saved history. The read-only prototype offers a saved-baseline selector;
choosing an item fills the exact reference without automatically reading sources
or recording a decision. Exact IDs remain available for older history.

One actual isolated PostgreSQL composed journey passed with the new metadata
list, real durable stores/audit and simulated paired/provider authority. The
owned socket-only server was stopped afterward. Six read HTTP checks and 14
combined client/evidence-view checks passed. Native registration/visual acceptance
and the complete authoring/approval workflow remain unfinished.

## Composed typed authoring and review (local prototype)

The optional authenticated-identity mode of GovernanceEvidenceView now connects
saved-source selection, an initial single-rule proposal and the exact saved
review panel. Without that identity it preserves the read-only prototype.
Authoring is limited to complete recorded GitHub evidence, merge/deployment
rules that block or require independent approval and verified evidence, and a
null parent. It cannot silently replace an existing active baseline. The server
still performs current-source preflight and independent review under locks.
Returned proposals must match exact typed scopes, rules and evidence bindings.

The composed UI test proves deliberate save followed by self-approval refusal;
no human decision or provider action is simulated as a real acceptance. Two
proposal-panel checks, ten client checks and the six-test evidence-view suite
pass; the earlier three-panel suite passed before the new composed test.
Desktop types passed before that test-only addition. This view is still not
registered in customer navigation or opened in a signed build. General baseline
editing, document source-head freshness, collector entry points, complete
mutation coverage, final whole-MVP review and activation remain pending.

## Active-source preflight composition (local)

The revision store now has a historical active-candidate read for out-of-lock
source preparation. It returns executionAuthorized=false, rejects revoked or
superseded records and requires current reader authority. It deliberately does
not treat stale source evidence as execution authority. The existing readActive
method still requires current principals and fresh evidence.

The internal, non-HTTP readActiveEvidence request method warms current sources
outside locks, then reloads the current active pointer and consumes the exact
request-local proof under existing locked source/role checks. A changed active
digest, expired proof or changed source refuses. It does not supply coverage,
provider permission or an action approval and returns no execution authority.

Six actual isolated PostgreSQL revision journeys passed, including stale source
versus candidate reads and revoked-candidate refusal. The composed request
journey passed with real artifact/revision/audit storage, simulated paired and
provider access, and explicitly test-only activation using simulated coverage.
Production request composition still refuses enrollment. Owned PostgreSQL was
stopped, and scoped server types passed. No production/customer data, provider
request, policy activation, settings or deployment was touched by these tests.

## Recorded source fact inspection (local)

The read dispatcher now also accepts an exact evidence digest. It returns only
the existing immutable artifact after tenant/current-reader and recorded-history
validation; it performs no new provider discovery. Strict desktop DTOs bound
fact types, counts and citation lengths and require the returned digest to match
the selection. The view shows recorded values and plain-text citations with an
explicit historical/no-compliance-verdict label. Citation text never becomes a
navigation or tool instruction; incomplete evidence never implies absence.

Seven HTTP checks, eleven client checks and seven evidence-view checks passed;
scoped server and desktop types passed. The composed actual-PostgreSQL journey
now also exercises both admission phases and refusal after recorded reviewer
capability removal. Coverage, provider authority and exact action approval in
that journey are simulated test-only ports, not live enforcement acceptance.
Owned PostgreSQL is stopped. A production build including TypeScript passed for
runtime commit02478ed4 in an isolated git archive with synthetic loopback DB
settings and no real credentials; this later source-inspection increment has
scoped types/tests, not a repeated full build. No deployment or setting changed.

## Immutable document bytes and current-head proof (local)

Document parser v2 marks empty/unrecognized requirements partial rather than
complete. The new document store retains bounded inert UTF-8 bytes in immutable
organization/name/scope/content-bound records and maintains an audited current
head with optimistic version comparison. No schema is added. Replacements keep
old bytes and history; competing versions refuse, and only the identical last
request nonce can recover without another head update. Upload capability uses
existing policy administration, while current reader/session checks remain
mandatory. Credential-shaped/binary/oversized data is refused before storage.

Internal uploadDocument composition saves the source artifact only after the
head/body proof is checked. No HTTP upload command or file picker is exposed
 yet. Fresh document observations read the audited current head and retained
bytes, never extend an expired historical snapshot. Locked source binding
checks content, typed facts, completeness and parser version against retained
bytes. Document revisions are content hashes: changed bytes produce changed
source reports, mismatched revision/content pairs remain unknown, and old
approvals cannot authorize changed sources. Parsing or upload does not approve,
activate, grant provider access or run document instructions.

Four actual owned PostgreSQL document tests and two composed request journeys
pass, with simulated paired authority/providers. They cover unchanged freshness,
changed-head refusal/drift, races, writer revocation, reader-only upload refusal,
nonce recovery, retained bytes and invented-fact/credential rejection. The owned
server is stopped. A 25-check parser/freshness/admission batch passed before the
explicit v2 tag; nine parser checks passed after the tag, then 23 shared
freshness/admission/guard checks passed after document drift classification.
Scoped server types pass. No production/customer document, migration, setting,
provider call or deployment occurred. Full build/final review for this later
increment remain pending; the earlier full build receipt applies to02478ed4.
