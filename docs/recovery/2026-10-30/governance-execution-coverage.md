# Governance execution coverage — local audit

No execution path is registered as covered yet. Enrollment remains refused by
request composition. This inventory is a starting audit, not a complete set of
provider mutation paths or evidence of universal enforcement.

| Path | Existing boundary to preserve | Outstanding Governance binding |
| --- | --- | --- |
| `lib/tauri/releaseProviderMergeExecutor.ts` | Durable claim, lease, before-dispatch authority, unknown-result recording | Server-owned exact repository/environment/plan; admission before claim and transport's final authority check |
| `lib/tauri/releaseProviderMergeTransport.ts` | Fresh credential, branch policy, exact head and final authority before PUT | Repeat current baseline/source check at final authority; no network under database locks |
| `lib/tauri/releaseDeploymentExecutionExecutor.ts` | Existing reviewed exact deployment execution | Audit all dispatch implementations and bind trusted environment/workflow/source |
| `lib/desktop/connectedActionsHttp.ts` and `lib/integrations/connectedActionTransport.ts` | Existing exact task/intent, durable claim, before-dispatch checks and one-attempt transport | Trusted scope association for Teams/Linear; do not infer repository authority from a channel/team |
| `lib/integrations/outlook/outlookActionTransport.ts` | Existing explicit mail/calendar action review | Trusted mailbox/calendar scope; preserve grants, independent review and no automatic resend |
| `lib/integrations/slack/slackNotificationExecutor.ts` | Existing exact notification review and execution | Trusted workspace/channel scope and both enforcement phases |
| `lib/axiom/agentRuntime/actionApprovalResponder.ts` | Existing tenant token and file/default-branch controls | Enumerate every supported mutation, including actions outside the current Governance action vocabulary; refuse unknown mutations in enrolled scopes |
| `lib/agent/workflows/stepExecutors.ts` | Existing workflow step dispatch | Enumerate each concrete mutating step and descendants; a dispatcher name is not coverage |
| Jira/ServiceNow ticket transports | Existing reviewed lifecycle, native policy and uncertainty history | Decide exact scope/action vocabulary before any enrollment claims ticket coverage |
| Native computer input | Exact selected window/text, confirmation and durable one-attempt outcome | Native/server coverage seam and trusted scope; no background-input permission |

## Local composition adapter

`lib/governance/intelligence/executionBoundary.ts` performs admission before a
trusted claim callback and immediately before its single trusted write callback.
It carries the exact context and prior receipt, propagates cancellation, and
never writes for a consumed claim. It does not retry, register coverage, replace
the durable store's guards, or record a provider outcome itself. A caller must
record post-claim failures through its existing refusal/unknown lifecycle.
Provider callbacks must retain their own bounded transport and final authority
checks. This adapter is not imported by a production executor yet.

Five focused simulated-callback checks passed: phase order, denied/revoked
admission, consumed claims, single failed-write invocation, cancellation after
claim, and preservation of the original context when the caller changes its
object. Scoped server types passed separately. No provider request, durable
claim, deployment, setting or schema change occurred in these checks.

## Provider merge composition increment

`governedProviderMerge.ts` now composes the existing durable merge executor with
its actual fixed GitHub transport. A mandatory trusted binding reader supplies
the stored plan and organization-owned scope. It checks actor/session/org and
exact plan hash before claiming; the existing store rechecks the plan under its
own authority. The actual transport's initial and final authority callbacks
repeat Governance admission using the original private pre-claim receipt.
Existing provider approval consumption, branch policy, credential, exact head,
lease and unknown-result recording remain unchanged. A shared 15-second signal
bounds binding/admission/dispatch; caller cancellation cannot authorize a write.

This factory is local and unmounted. No repository/environment mapping or
coverage registration has been fabricated, and production activation remains
refused. Connected-app, native and other Agent mutation paths are not covered
by this factory.

Six new simulated-provider composition checks pass. The first four plus the
existing executor/transport suites passed as a 23-check batch; two additional
checks cover changed stored plans and cancelled hanging bindings. Scoped server
types passed. These checks use the actual transport with simulated fetch/store
and admission ports, not live GitHub or a production claim. No merge occurred.

## Exact release scope mapping

The local governed merge factory now requires the selected stored release
projection as well as its exact plan/context. `releaseScope.ts` rebuilds the
merge plan against that intake/version/digest using the existing release
validator, then derives repository/resource identity and the canonical target
environment from the stored intake. It refuses environment aliases and custom
names instead of guessing. The supplied context must exactly match the derived
context. The binding reader remains responsible for current tenant/session and
reviewed-plan authority; the store independently rechecks these before claim
and dispatch. This pure mapping is not authority, enrollment or activation.

Eight scope checks and six governed executor/actual-transport composition checks
pass (simulated store, guard and provider). Scoped server types pass. Current
server binding-reader/active-baseline composition and coverage registration are
still pending; no live merge or provider read occurred.

## Paired request admission composition

`requestAdmission.ts` binds every admission context to the original paired
organization, actor and session. Each claim/write phase obtains the actual
request service's fresh active-baseline proof, retaining evidence privately for
that invocation. Evidence and refresh receipts cannot be supplied by the action
authority port. Its exact-action authority must independently verify the same
baseline digest; an older provider approval is not reinterpreted as Governance
approval. Missing coverage, swapped actors and source expiry remain refusals.

Five new composition checks and the 20-check guard/merge/scope regression batch
pass; scoped backend types pass. Ports/provider responses in these checks are
simulated. This adapter is not mounted in production, coverage is not complete,
and activation still refuses. No existing approval, action or source was used.

The owned isolated PostgreSQL request journey now uses this actual request
admission adapter rather than a handwritten test closure. One composed journey
passed (one unrelated document journey skipped): immutable collect/propose,
self-review refusal, separate reviewer approval, explicit fixture-only activation,
both admission phases, drift and refusal after the reviewer's role is removed.
Stores/locks/audits are real; paired-session verification, provider responses,
coverage and exact action authority are simulated. No live action was claimed
or sent. Owned socket-only fixture was stopped afterward.

## Existing release coordinator seam

The existing provider-merge coordinator now accepts a trusted server-only
Governance guard. If explicitly configured, it captures that branch and refuses
missing/malformed guard configuration; it cannot fall back to legacy execution.
Its binding reader is constructed internally, not supplied by HTTP input: it
reads the existing prepared operation and exact reviewed plan, derives the
repository/environment from the current stored release, and rechecks the paired
caller around the reads. Existing actual governed executor, fixed transport,
provider policy/credential checks and durable claim/outcome handling are reused.

Twenty-six coordinator/binding-reader/governed-executor checks and twenty-one
existing execution/operation HTTP checks pass. Scoped types explicitly include
the edited coordinator. Focused fresh-context review found no important defect.
All stores/provider transports in these new checks are simulated. No production
HTTP composition supplies the guard yet; no scope is enrolled, no baseline is
activated and no provider action ran. Remaining action-approval baseline binding
and coverage across other executors are still required before enrollment.

## Exact baseline-bound provider approvals

The existing provider-merge approval store now supports an optional immutable
`governanceBaselineDigest` for a *new* independently reviewed decision. It is
preserved in the execution binding and consumed by the same atomic one-attempt
claim. The baseline-aware reader refuses old unbound approvals, changed digests,
revocation and a missing trusted baseline verifier. Every new bound approval's
audit events include the full immutable binding hash; removing/changing the
field or retrofitting old approval history refuses. Old unbound records retain
their original representation and legacy behavior.

The request service exposes a DB-only exact baseline verifier that derives the
merge scope from the stored release and reuses the caller's existing transaction.
Current active revision, principals and prewarmed source receipts are checked;
there is no nested transaction or provider network read under these locks.
The owned request PostgreSQL journey passed this actual verifier and deliberate
digest-mismatch refusal, and its provider-spy count did not increase. External
session/provider/action coverage remain simulated. Fixture stopped.

Approval/store regression batch: 59 passed before the added historical-stale
regression; the later 44-test approval/preflight batch passed including that new
case. An additional invalid-clock classification regression passed with all four
preflight checks. Backend/desktop types and existing approval panel/HTTP tests
pass. Review found one historical recovery issue, corrected: only typed baseline
or source invalidation becomes a stale historical DTO; missing configuration,
invalid clock or caller authority remains a hard failure. Execution always
refuses stale decisions. The saved approval panel displays a bound digest when
present.

This does not enable issuer HTTP input or a new human decision: the current
HTTP/native issuance flow does not yet offer baseline-bound approval. Default
production coordinator supplies neither Governance guard nor verifier; enrollment
still refuses. All other mutation coverage and exact human review/activation
remain required. No provider write, claim, grant, migration, deployment or paid
build occurred.

## Enrollment-transition fence

`readScopeEnrollment` verifies the paired reader and the exact tenant-derived
active-pointer primary key. A malformed/inaccessible record cannot be mistaken
for an absent enrollment. The separate server-only scope-aware admission wrapper
preserves existing executor authority only for positively absent enrollment;
it repeats the check before write, rejects enrollment transitions, changed
baselines, unknown reads and forged/modified prior receipts. Strict admission
remains mandatory for enrolled scopes. Seven focused checks and the updated
actual owned request PostgreSQL journey pass; source/provider/action coverage in
the fixture remains simulated, fixture stopped. This wrapper is not selected by
production composition yet. It grants no authority to an uncovered executor or
a caller-supplied scope and does not enable enrollment.

## Exact baseline review HTTP/native path

Provider-purpose approval HTTP now selects the actual Governance request-service
preflight only behind the existing, unchanged default-OFF Governance server flag.
A trusted composition checks current enrollment and warms source proof outside
locks; positively unenrolled organizations/scopes keep existing issuer behavior.
The required active digest is returned for human review. POST must echo that
exact digest, never silently attach new policy to an old decision. The store's
locked baseline verifier rechecks authority/pointer/source receipts. Explicitly
malformed composition and unknown checks refuse. Revocation remains available
without warming policy sources.

Native review shows the exact required digest before its human checkbox, carries
it into approval, and treats a wrong acknowledgement as unknown with no automatic
retry. Existing unbound approvals become historical stale metadata when current
policy requires a different binding; they are never rewritten. A real human must
still review and approve using their own current session.

Thirty-five HTTP/composition/client/panel checks, scoped backend/desktop types and
one actual owned isolated request PostgreSQL journey pass. The PG journey uses
the actual HTTP-preflight composition and locked verifier; external provider,
request-session and coverage/action authority remain simulated. Fixture stopped.
Independent local review found no important issue. No flag was changed, no scope
enrolled, no human decision made, and no live provider read/write occurred.
Execution composition and complete coverage across mutation paths remain open;
activation still refuses. Native relaunch/visual verification follows separately.

## Deliberate native inspection entry

Settings → General → Inspect saved Governance now opens a read-only local
preview and returns to the same Settings instance. It does not pass authoring
identity to the evidence prototype, even for administrators. Current paired
workspace-read access is required for the preview; all server reads still
recheck actual authority. Identity changes remount the evidence session and
clear displayed records. Opening performs no network request. Provider source
checks remain separate, deliberate read controls; no collection, upload,
proposal, approval or activation control is exposed by this entry.

Four new preview checks plus eight existing evidence-view checks pass, followed
by thirty Settings preference/permission/model checks (including the actual
entry-and-return journey). Desktop types and frontend build pass. The current
backend runtime's exact tracked production build is c683793d and passed before
this frontend-only delta; no backend runtime changed in this increment. This is
source/component acceptance; the new Settings entry is not yet in the open8c
native preview. It is not full Governance enforcement or live acceptance.

## Feature-disable approval fence

A reproduced regression allowed approval issuance to skip Governance composition
when its feature flag was OFF. The regression first returned201 instead of409.
Approval HTTP now always selects the trusted enrollment preflight unless an
explicit server composition is supplied; malformed explicit composition still
refuses. A metadata-only paired-reader check can prove absence even while the
feature is OFF. An exact active pointer still requires enabled policy checks,
so disabling configuration cannot mint an unbound legacy decision for that scope.
Other positively absent scopes preserve legacy behavior. Revocation does not
warm Governance and remains available. No source read or execution authority is
granted by enrollment metadata.

Twenty-six approval HTTP/composition checks pass, plus scoped backend types and
one actual isolated request PostgreSQL journey (one unrelated journey skipped).
The database journey now verifies disabled-configuration metadata, refusal for
an active pointer and positive absence for another scope. External provider and
paired-session ports remain simulated; fixture stopped. Full execution coverage
is still incomplete; this closes one issuance bypass, not all executor gaps.

## Refusal coverage for uncovered server execution

`uncoveredExecution.ts` uses current paired-reader enrollment metadata with
policy evaluation disabled. Only literal false permits existing legacy checks;
any enrollment, unknown result, cancellation or failed read refuses. Because an
uncovered executor cannot map every resource reliably, any enrolled scope in
that organization conservatively blocks this legacy execution path.

The actual merge coordinator now fences preparation and composes the fixed
legacy executor/transport with fresh refusal checks before claim and both
transport authority phases. Existing explicitly configured Governance guards
still use their stricter scope-aware path. Read-only recovery and cancellation
remain available. The actual transport regression demonstrates enrollment
appearing after its GET prevents PUT, while unknown provider results retain the
original consumed attempt without retry.

`uncoveredMutationStore.ts` is mounted at the server connected-app (Teams/Linear),
Outlook, Slack and deployment execution store compositions. It repeats the
refusal check before claim and after original beforeDispatch authority returns.
It does not replace their approvals, current target checks, outcomes, recovery
or cancellation. This adds no provider I/O or new principal resolution inside
existing store transactions. There is no policy permission fallback.

Twenty-eight merge/fence/coordinator checks and38store/HTTP checks passed; two
additional deployment HTTP refusals/recovery checks then passed in a20-check
batch (overlap). One actual isolated request PostgreSQL journey passed with
literal absence before fixture-only activation and refusal afterward; external
provider/session/coverage remain simulated, fixture stopped. Scoped types and
focused independent review pass. These are refusal seams, not proof of complete
enforcement: other Agent/direct/native/ticket paths and actual enrolled action
admission still need composition. Enrollment/activation therefore remain refused.

## Ticket and native refusal seams

Legacy Jira/ServiceNow lifecycle HTTP stores now use the same pre-claim and
post-authority dispatch fence. The associated-ticket server composition checks
before transport preflight and repeats the check in its actual claim-bound
transport callbacks, including journal verification. Existing ticket/native
lifecycle approvals and already-consumed unknown outcomes are unchanged. No
ServiceNow note was sent, reset, renewed or recovered by this work.

The Bot native owner endpoint refuses new input attestation for uncovered
Governance enrollment. Recovery authority is now a separate exact closed action,
textedit_read_outcome. It still verifies paired identity, current task/version,
nonce and lifetime. Rust requests/validates that action only for recovery; Swift
accepts it only for operation4. Recovery proof cannot authorize input, and input
proof cannot authorize the recovery operation. Stop remains non-executing.
No window picker, native alert or real computer input was invoked.

Thirty-two server/controller/adapter checks pass (overlapping an earlier58-check
ticket/native composition batch).329 synthetic Swift policy/metadata-ledger
assertions and12 Rust authority tests pass. An initial Rust filter selected zero
tests and was NOT counted; the corrected computer_input::authority filter ran12.
Scoped backend types include all edited HTTP compositions. Focused independent
review found no important security/recovery issue. These refusal seams are not
complete active policy admission or coverage of every direct/Agent path.

### Desktop GitHub legacy mutation fences (remaining-credit increment)

The paired desktop branch, single-file commit and pull-request routes now use the
existing tenant enrollment metadata refusal check before credential resolution,
and pass a trusted server-created callback to the existing GitHub transport for
an immediate pre-write recheck. Request data cannot supply this callback. Existing
paired-session capability, tenant token, default-branch restriction and audit
behavior remain. Enrolled or unavailable metadata refuses; only positive absence
permits the existing legacy path. This is refusal coverage, not policy admission.

Verification: 15 new simulated route tests plus existing enrollment/transport
checks: 68 passed. Scoped production TypeScript for the three real route entry
points passed. No live GitHub reads/writes, full build, deployment, new grant or
installer publication was performed. Tests cover initial enrollment, metadata
failure, positive absence, enrollment introduced before transport and missing
session. Other environment/Airflow/alternate callers and real default admission
remain incomplete; activation must continue refusing incomplete coverage.

### Desktop environment dispatch refusal fence

The desktop ECS deployment entry point now refuses enrolled/unavailable Governance
before resolving provider credentials or reserving deployment usage. The same
trusted callback is checked by the actual GitHub write transport immediately
before dispatch. Emergency deployment-policy bypass cannot bypass this fence.
A definite pre-dispatch refusal releases the reservation using the existing
classifier; uncertain dispatched outcomes retain the original hold and history.
33 route/classification checks and scoped production types passed; provider
responses and reservation storage were simulated. No workflow was dispatched.
This closes another legacy refusal path; it does not supply baseline admission
or complete Airflow/alternate caller coverage or permit activation.
