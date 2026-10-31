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
