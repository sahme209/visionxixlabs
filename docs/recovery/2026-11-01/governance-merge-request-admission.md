# Trusted merge admission — local composition evidence

This increment connects the persistent numeric execution-policy issuer to actual
provider-merge request selection, stored operation authority and provider proof.
It is local source and simulated-provider acceptance. No live GitHub request,
production claim, credential grant, migration, human review or activation occurred.

## Implemented path

`releaseProviderMergeStore.validatePrepared` is a DB-only current read. It reuses
exact operation/history, plan/release/connection, memberships, independently
reviewed provider approval and DB-clock lifetime checks without a write, lease,
attempt or consumption. It refuses another session, changed source and every
non-prepared state. Its approval read deliberately omits operation ID, so the
special consumed-for-this-operation readback cannot authorize pre-claim proof.

Coordinator credential/topology authority chooses prepared validation or existing
`beforeDispatch` from current stored state. Request data cannot select phase.
It preserves the actual paired principal, release allowlist, adapters/flags,
current installation, source/approval and existing one-attempt guards. When
current paired enrollment metadata shows an organization has enrollment, default
server selection constructs the real stored binding, request service, provider
preflight and scope-aware admission. Unknown metadata refuses. Positive absence
retains the existing uncovered executor with repeated transition checks. Explicit
server guard configurations retain their original strict no-fallback behavior.

`mergeRequestAdmission.ts` joins the stored exact plan/context and operation to
fresh active-baseline source receipts, current exact-scope persisted numeric
limits and the real baseline-bound `readGovernanceProviderApproval`. Before
claim it requires unconsumed approval; write phases permit readback consumed only
for this exact operation. The initial numeric policy digest is retained privately;
replacement with even the same numeric level refuses. Roles, sessions, expiry,
baseline and original approval remain independently current. The final numeric
read follows the final awaited operation authority check. Provider work completes
before the locked approval/policy transaction. No rollback proof exists here, so
`rollbackVerified` remains false and a rollback-requiring baseline refuses.

`mergeProviderPreflight.ts` uses the actual fixed credential and direct-support
readers, and checks exact plan/repository/connection/PR/head/base bindings. Each
admission phase repeats current provider evidence. It does not infer provider
access from source freshness or from an action approval. Tokens stay private.

The actual direct-support reader now retains provenance in a private WeakMap,
bound to exact plan, credential, returned support and the source digest of its
repository/PR/rules/topology reads. Its original observation/expiry survives.
Only an object actually issued by that reader can supply this proof; a copied
object or arbitrary optional API metadata cannot. Legacy transport's Boolean
result contract is unchanged. The new private Governance receipt expires at the
minimum of five seconds, credential remaining authority, original topology
proof expiry and its original observation plus the thirty-second maximum age. Expiry during the final awaited check refuses. Wrapping a near-
expired topology proof cannot give it five fresh seconds.

The actual transport still performs its credential, repository/branch policy,
exact target and final authority checks before its only PUT. Unknown results
retain the consumed attempt and existing recovery behavior. No retries were added.

## Coverage and customer workflow remain closed

The real request service's execution-coverage reader returns no registered
covered actions. Neither stored numeric policy nor exact approval manufactures
coverage. Default enrolled admission therefore refuses before claim or provider
credential proof. Existing preparation refusal for enrolled organizations remains;
this increment does not expose a new enrolled preparation workflow. Baseline
enrollment/activation still refuses incomplete coverage. Feature flags were not
changed. Exact-scope positive absence is distinguished from unknown/enrolled
state by the existing scope-aware adapter.

The real desktop provider-execution route already selects the coordinator's
scoped token and verified-topology adapters through the existing scoped release
acceptance configuration; this increment does not widen that allowlist. Actual
enrolled execution cannot pass the intentionally empty production coverage gate.

## Verification

- Two prepared-validation regressions reproduced the missing method before the
  implementation. The 21-check store suite passes, including no durable effects,
  source/identity refusal, consumed-state refusal and unconsumed approval read.
- Nine private-provider-proof checks cover actual-reader provenance, exact plan/
  credential identity, copied/forged results, one-use receipt, source changes,
  expiry, cancellation, role loss and evidence expiring during an awaited check.
  Independent review identified that the original maximum age also had to cap
  the receipt. Two regressions reproduced evidence observed 29 seconds earlier
  being freshened to five seconds, and issuance after the final await crossed
  thirty seconds. Both now refuse at the original age boundary; the focused
  proof/direct-support batch passes 33 checks.
- Coordinator tests cover default real composition selection and no fallback on
  unknown metadata. Existing adapter tests retain explicit simulated positive
  absence and now pass a real transport input through their mocked executor.
- Four new owned isolated PostgreSQL journeys pass. They use real reviewed plans,
  durable baseline and policy revisions, independent provider approval, exact
  operation/history, claim/consumption and the actual executor/transport. Actual
  credential/direct-support/topology readers consume simulated GitHub replies.
  One journey confirms provider topology proof while attempt count is zero and
  exactly one simulated PUT only after the real claim. Others verify revocation
  after claim, same-level policy replacement and absent coverage: no PUT; missing
  coverage also leaves attempt zero and performs no provider credential request.
- Every simulated provider request independently acquires operation and reviewed-
  plan locks with `FOR UPDATE NOWAIT`, showing neither store lock is held during
  provider I/O. Fixture baseline activation/coverage, paired-request authority,
  plan review and provider approval authority ports are explicitly simulated;
  this is not acceptance of those external/current-principal boundaries.
- The final owned PostgreSQL batch passed eight tests: four new merge journeys
  plus four issuer regressions. The fresh socket-only fixture was stopped in
  `finally`; no inherited connection URL or external service was used.
- The broader related local batch before that final age correction: 346 passed, 24 database tests skipped across 43
  passing and six skipped files. This includes the Intelligence suite plus actual
  merge store/transport/credential/direct-support/topology/coordinator/HTTP suites.
  The four new PG journeys were explicitly run separately; remaining skips are
  not database acceptance.
- Final scoped production TypeScript passed in a current-source archive stage
  using the locked SDK overlay, including every edited production source.
  `git diff --check` passes. Parent independent review follows; no commit is made
  by this worker.

Logs: `work/governance-intelligence/merge-admission-pg.log`,
`merge-admission-types.log`; staged source path is recorded in
`merge-admission-type-stage.txt`. Fixture runner remains under the same untracked
work directory. These are local evidence files, not publishable artifacts.

## Remaining root dependencies

Complete execution coverage and its verified registration are still required
across all mutation paths before enrollment can be offered. Actual source reads,
real paired-session/provider authorization, genuine human decisions, customer
policy/review/activation UI and native journeys remain separately gated. Other
executors do not acquire Governance permission from this merge composition.
Full production/frontend/native checks and independent review are still needed.
No full-MVP, live enforcement or deployment acceptance is claimed.
