# Axiom Agent master-mission status

## Privacy-choice resilience and current scope checkpoint

PR #117–#122 are merged; all automatic main builds are READY, including
`dpl_EMociHcCvJd6Fgphf52qVW1S45Vz` at `478f16d2`. Sign-in/providers return 200
on the latest build and public domain, with credentials/Google/GitHub/Cognito
registered and callbacks on visionxixlabs.com. Actual login/founder mapping is
unverified; protected SQL preflight dispatch returned Forbidden. The environment
listing is truncated, so production database-binding absence is not inferred.

The privacy follow-up preserves the existing reopening control, handles denied
read/write persistence and synchronizes another tab’s decision. Future SDK
events consult current consent and are blocked after withdrawal/unmount. When
saving fails, the UI explains that the preference could not be retained and
keeps essential features available while permitting the user to continue.
Thirteen real DOM cases cover these boundaries; actual browser/network privacy
acceptance is separate. Production dependency advisories remain zero; the
broader audit records nine existing development-tool findings, unchanged by
the dev-only DOM tools. See [privacy validation](PRIVACY_CONSENT_VALIDATION.md).
The uploaded 24-section unified prompt was verified byte-for-byte against its
repository copy; the older 36-section source and A–L scenarios remain missing.

Validation passes: 539 Vitest files / 5,338 tests, targeted privacy lint, web and
desktop TypeScript, desktop frontend build, 30 Python CLI tests, full Next.js
production build and mission coverage check. Headless Chromium still times out
even for a clean blank page outside the restricted sandbox; browser visual and
network acceptance remain unverified. The exact older master-spec path is also
absent from all fetched history in this non-shallow repository.

## Billing reservation integrity follow-up

PR #121 merged at `f27adac5` after exact-head CI `38776598039` passed. The next
focused billing repair reproduces four invalid reservations reaching invoice
submission: a different organization, usage event, larger amount or smaller
amount. Binding validation now blocks all four and retains existing ledger and
quota state for reconciliation. Valid retry keys/amounts and the test-only
billing gate remain intact. See [binding evidence](BILLING_SETTLEMENT_BINDING.md).
Validation: 538 Vitest files / 5,325 tests, web and desktop TypeScript, desktop
frontend build, 30 Python CLI tests and mission coverage check. Production data,
credentials, migrations and billing activation are outside this repair.

## Website metadata follow-up

PR #120 merged at `5981608b`; exact-head Node 24 CI `38772363956` and its
automatic deployment `dpl_Dd2pg3shwBVsY1QnsQxEQ7pCRpT7` are green/READY.
A read-only public route audit confirms nine HTTP 200 pages, but docs repeat
the brand title and inherit the homepage canonical. A focused correction adds
page titles/canonicals for docs, pricing, downloads, security and terms. No UI
redesign, legal-text change, billing activation or production promotion is
part of this work. See `docs/mission/public-route-audit.json` for scoped evidence.
Login and founder verification remain blocked; cloud screenshot capture has
not succeeded, so visual/native acceptance is not inferred.

Validation passes: web/desktop TypeScript, 538 Vitest files / 5,321 tests, desktop
build, 30 Python CLI tests and full Next production build. A local production
server returned the correct canonical and a single brand suffix on all five
repaired routes. Cloud screenshot and native/browser interaction acceptance
remain unverified.

## GCP dependency and token-contract follow-up

PR #119 merged at `65eafebb` after exact-head Test run `38770152418` passed.
The follow-up uses Storage 8.4.0 within the existing major; production dependency
audit now reports zero registry findings. Web CI aligns with existing Vercel
Node 24 rather than changing production configuration. A real snapshot-reader
bug is fixed: GoogleAuth returns a string, not a token object. Seven focused
cases pass; no real provider credentials or cloud writes are used. Wider GCP
acceptance, database/founder preflight and login recovery remain open. The
protected read-only workflow dispatch was attempted via authenticated CLI but
GitHub returned Forbidden before starting it. #118/#119 automatic builds are
READY; the public alias was last confirmed on #116, with no manual promotion.

Validation passes: 538 Vitest files / 5,321 tests, web and desktop TypeScript,
desktop frontend build, 30 Python CLI tests, the full Next.js production build
and mission coverage check. Exact-head CI and automatic deployment evidence
belong to the focused follow-up PR. No actual GCP, production login or current
macOS package acceptance is inferred from these checks.

## Security follow-up — production dependencies

PR #118 merged at `d36e5636` after exact-head web checks (`38769106692`)
and native tests/clippy (`38769106653`) passed. Its automatic main deployment
is being checked independently; this is not production-login acceptance.

The next focused patch updates Next/ESLint 16.3.6 → 16.3.8, sharp 0.35.4 →
0.35.5 and source-map-js 1.2.1 → 1.2.2. A clean isolated install and registry
audit report zero high/critical and two moderate production dependency findings
(down from six high/six moderate). Remaining Google uuid/gaxios findings remain
open. See [dependency audit](DEPENDENCY_SECURITY_AUDIT.md). Exact-head validation
and merge evidence are recorded in the focused PR; no migration or account
change is part of this patch.

## Audit-driven execution — desktop identity contract

PR #117 merged the permanent complete-scope tracker at `62d35145`. The first
independent repair reproduces a 503 body being accepted as verified identity,
malformed responses throwing during startup, and truthy non-boolean access.
A pure response validator and HTTP-status gate now reject those cases without
granting authority. Valid denied access and legacy optional capabilities remain
supported. The sidebar now says Workspace connected rather than asserting
production entitlement. The commercial-policy discrepancy and actual login
incident remain open; no account, credentials or production data are changed.
Validation passes: 537 Vitest files / 5,314 tests, web TypeScript, desktop
TypeScript/frontend build, 30 Python CLI tests and the tracker coverage check.
The audit PR's automatic main deployment `dpl_8AV4shNSfHpihfYESxeV7DZXbatz`
is READY. No current native/macOS or successful production-login claim is made.

## Complete scope audit and permanent requirement register

The current scope index is [AXIOM_COMPLETE_MISSION_TRACKER.md](AXIOM_COMPLETE_MISSION_TRACKER.md),
with editable per-row evidence and next actions in `docs/mission/requirements.json`.
It covers the available original handoff, unified mission, former Claude scope,
decisions and implementation plans. Exact coverage of the older 36-section
specification and scenarios A–L remains blocked on missing source; the register
does not silently replace it with inferred requirements or a completion claim.

Fresh current-main evidence changes the prior routing snapshot: the public
domain now targets the #116 deployment, without a routing operation by this
agent. Credentials and Google callbacks on that deployment still show P2022.
Production schema/founder preflight remains required. Historical sections below
retain their original evidence dates and are not current readiness assertions.

## Continuing mission — final Gateway prompt redaction

PR #115 merged at `40fbbd48` after exact-head GitHub validation passed.
The next security audit reproduced known secret patterns reaching the SDK in
system prompts and composed schema/classification instructions. The final
Gateway call now redacts both prompt and system strings after composition,
including direct provider calls, summaries and streams. All six regressions
fail before the fix and pass afterward; options, attribution and response
metadata are preserved. No network inference, credential, routing or billing
change is involved. Known-pattern coverage is not universal secret detection.
Local checks pass: 537 Vitest files / 5,291 tests, web TypeScript, desktop
TypeScript/frontend build, 30 Python CLI tests and diff whitespace checks.

## Continuing mission — settlement batch progress

PR #114 merged at `df8d3788` after exact-head GitHub validation passed.
The next query audit reproduced a completed event consuming a one-row batch
on every tick. Candidate selection now excludes submitted settlement rows
before LIMIT, preserving recent reserved retries and new settled usage. The
existing serializable ledger recheck and bounded retry policy remain in place.

The parameterized SELECT was exercised against disposable PostgreSQL 16:
the old selection returned `done`; the repaired one-row batch returned `retry`,
and a two-row batch returned `retry`, `new`. In-memory SQL regressions also
cover pending/zero-cost exclusion and limit bounds. No production database,
migration, provider request or billing setting was used. Full queue fairness
and operator reconciliation remain separate gaps; this fixes completed rows
starving newer candidates, not every blocked-work scenario.
Local validation passes: 537 Vitest files / 5,285 tests, web TypeScript,
desktop TypeScript/frontend build, 30 Python CLI tests and diff whitespace
checks. The PostgreSQL fixture was removed after verification.

## Continuing mission — bounded Stripe settlement retries

Main `5541fd04` includes PRs #111–#113; their automatic main deployments are
READY. The custom domain was separately verified on the older PR #106 build;
no promotion was performed. Database/founder mapping and real login remain
unverified. The only unrelated open PR at this audit was the old Analytics draft.

The next billing audit reproduced a 25-hour-old unresolved settlement calling
Stripe again. Stripe's documented API v1 idempotency retention is at least
24 hours, after which reuse can create a new request. A pure retry policy now
permits only reserved rows less than 23 hours old. Old/invalid/future rows and
other unsettled states remain held and count as blocked; submitted rows skip.
No allowance is released, key reset, billing flag enabled, or provider called
by these mocked tests. Operator reconciliation and actual isolated test-mode
acceptance remain required; this is not a live financial readiness claim.
Local validation passes: 536 Vitest files / 5,277 tests, web TypeScript,
desktop TypeScript/frontend build, 30 Python CLI tests and diff whitespace
checks. The 19 added cases cover cutoff boundaries, clock anomalies, state
gates, recent same-key replay, submitted rows, timeout retention and live-key
rejection without contacting Stripe.

## Continuing mission — Gateway cost receipt identity

PR #112 merged at `e99af1d3` after GitHub web and native desktop checks passed.
The next billing audit reproduced settlement accepting an unrelated or empty
Gateway generation ID. Reconciliation now requires the returned receipt ID to
match the event's captured external usage ID before entering any transaction.
Mismatch counts as a failed reconciliation attempt while leaving usage and
reservations pending. Existing margins, spend caps and test-only Stripe gates
remain intact. No provider request, live billing or production SQL is used by
the regression tests. Installed SDK source and generation lookup documentation
confirm that the returned ID identifies the requested generation.
Local validation: 534 Vitest files / 5,258 tests, web TypeScript, desktop
TypeScript/frontend build and 30 Python CLI tests pass. PR #112's automatic
main deployment `dpl_UD3SX64s38kax51LsyXTk5Fg74o8` is READY. These results
do not establish live provider reconciliation, financial or login readiness.

## Continuing mission — concurrent deployment observations

PR #111 merged at `ee8125f5` after GitHub web and native desktop checks passed.
The following audit reproduced a delayed active observation overwriting a
newer completed result. Observation persistence now compares the exact stored
snapshot before updating. If another request changed the row, the response
returns the current tenant-scoped record without writing stale audit evidence.
A disappearing record returns 404. These are automated regression checks;
no production record, provider workflow, schema or credentials are changed.
Local validation passes: 534 Vitest files / 5,256 tests, web TypeScript,
desktop TypeScript/frontend build and 30 Python CLI tests. PR #111's automatic
main deployment `dpl_84sM3yz7h6xcPZDUjX1iJfpchXCJ` is READY; its direct
sign-in and auth-provider endpoints return HTTP 200. This does not verify an
authenticated login or the custom domain's current alias.

## Continuing mission — deployment receipt visibility

Main `ad467cc5` includes merged PRs #109 and #110; both automatic Vercel main
deployments are READY. Their source and CI evidence is recorded in the PRs.
Production login and database/founder mapping remain unverified.

The next UI audit reproduced that records with no workflow receipt were
labeled in progress and continuously polled. A pure presentation/observation
policy now keeps them awaiting verification without a polling loop. Active
recorded runs still poll; Refresh status reuses the existing observation path
without dispatch, retry or hold-release authority. Refresh failures preserve
the existing record and clear busy state. Late environment/execution responses
are ignored. The existing layout, authorization and billing limits remain.

## PR #109 merged; scheduled-trigger reliability follow-up

PR #109 merged normally at `a604e72d` after its exact head passed GitHub
Typecheck + Vitest and Desktop CI, including native tests and clippy. The
founder explicitly authorized completing the merge and Git-triggered build.
No branch rules were changed or bypassed; the preview provisioning error
remains recorded separately from application checks.

The next source audit reproduced overlapping scheduler ticks and a lost
provider response producing fresh DAG-run identities for the same occurrence.
The follow-up assigns a stable tenant/rule/DAG/occurrence identity and resolves
409 only by reading the exact run. Manual triggering is preserved; other errors
and mismatched conflicts fail. Provider uniqueness and retained run identities
are prerequisites; no general exactly-once or cancellation claim is made.
No database migration or real Airflow dispatch is performed by these tests.
Validation: 533 Vitest files / 5,248 tests, web TypeScript, desktop
TypeScript/frontend build and 30 Python CLI tests pass. PR #109
production deployment `dpl_8xfHbWuRrPoaUymRWd6GVEm5eJ7j` is READY.
The scheduler follow-up proceeds as its own validated PR; production login
and database/founder verification remain unconfirmed.

## GitHub/Vercel identity correction · 2026-10-15

The authenticated GitHub account, repository, Vercel repository link, namespace
admin access and confirmed Vercel owner all identify `sahme209`. Earlier cloud
commit authors were not associated with a GitHub account. Repository-local
future author email now uses the account-specific GitHub no-reply address;
verification commit `baf8a4df` resolves author and committer to `sahme209`, and
Vercel event metadata records that author login. No history was rewritten or
account credentials, installations, permissions or working deployment settings
changed. The new preview still fails provisioning before build, demonstrating
that author association alone does not fix the platform error.

PR #108 has since been merged at main `7316be61`; its existing production
deployment `dpl_8Pghk2udZ5MnaGchysd21zJWjkRa` is READY. The integration branch
merged this main revision normally, with an identical file tree; its 5,237-test
source validation remains applicable. Detailed evidence is in
[the author diagnosis](VERCEL_GITHUB_AUTHOR_DIAGNOSIS.md). Application founder
identity and the read-only database/login verification gate are unchanged.
The sections below retain historical snapshots rather than claiming they are
the latest PR/deployment status.

## Integrated local candidate · 2026-10-15

Branch `codex/mission-reliability-integration` combines the independent
reservation, uncertain-dispatch, Airflow quota, workflow-input and sensitive
evidence repairs on the tested #108 head. Overlapping status/walkthrough notes
and approval regressions were reconciled while preserving every case. Before
the history follow-up, the combined candidate passed 531 files / 5,235 tests,
web TypeScript, desktop TypeScript/frontend build and 30 Python CLI tests.
These are local results; #108 remains at its original CI-tested head.

The history follow-up now redacts known structured sensitive snapshots from
conversation action arguments/results, including nested inspections and
multi-file reviews, without modifying stored records. Focused route tests
verify withholding, preservation of ordinary source and unchanged stored
fixtures. This does not establish that historical free-text turns are free
of secrets; private historical review and any remediation remain separate.

Main is unchanged; #108 remains blocked by Vercel provisioning failure and
the separate production-release boundary. No production migration, data write,
credential change, billing activation, provider dispatch or deployment runs.
Final integrated validation: 532 Vitest files / 5,237 tests, web TypeScript,
desktop TypeScript/frontend build and 30 Python CLI tests pass. Native Rust
source is unchanged from #108, whose GitHub native tests/clippy pass; this
local integration is not represented as a new native CI or live validation.
The ledger sections below preserve each prior source/validation snapshot.

## Continuing follow-up — Airflow deployment allowance parity

Airflow previously dispatched directly and created a deployment record afterward,
bypassing the shared allowance reservation used by desktop and Agent paths. It
now reserves against the same serializable quota with a stable execution key,
links recorded replays without dispatching, and settles the same reserved row.
Failed intent persistence before dispatch can release the new slot; uncertain
provider outcomes retain it and its reference for reconciliation. Recorded
approvers remain the attributed actors. Existing plan limits/prices and human
production approvals are unchanged. Four regressions failed before the repair;
focused cases cover quota denial, stable key/settlement, replay, intent failure,
tracking failure and an uncertain response without a second dispatch.

Airflow allowance validation: 531 Vitest files / 5,222 tests and web
TypeScript pass. Desktop/Python code is unchanged from the preceding passing
dispatch milestone. No real provider or database call was made.

## Continuing follow-up — uncertain desktop and Agent dispatch responses

Four regressions reproduced release of a deployment hold after transport or
provider-server failure. Both desktop and Agent callers now release only
explicit non-accepting GitHub responses; network/server/unknown failures retain
the durable reservation and return `deployment_outcome_unknown`. Same-key
retries remain blocked even after the former expiry. Desktop and persisted
Agent conversation messages describe uncertainty without asserting that a
provider deployment failed or completed. The existing Agent processing-status
model is preserved. A receipt-reconciliation/operator-release journey remains
unfinished; no automatic resend, live provider call or billing activation occurs.

Validation for the continuing dispatch repair: 531 Vitest files / 5,217 tests,
web TypeScript, desktop TypeScript/frontend build and 30 Python CLI tests pass.
The React review found no new hooks, effects, dependencies or layout changes;
only outcome copy and typed response handling changed. No provider call was
made by these tests. This follow-up remains separate from PR #108.

## Separate follow-up — unresolved deployment reservations

An unrelated reservation request previously deleted reserved execution rows
older than fifteen minutes before checking quota. A stale row can represent
a provider-accepted dispatch whose receipt was not saved, so age alone cannot
justify discarding its slot or idempotency key. The local repair removes that
automatic deletion; explicit release/settlement paths are unchanged. A
stateful regression fails before and passes after the repair. This conservative
hold may consume allowance until a governed reconciliation flow is completed.
No prices, plan limits, live charges, records or migration are changed.
Local validation: 530 Vitest files / 5,195 tests and web TypeScript pass.
Desktop/Python code is unchanged from the passing #108 candidate. This
follow-up is retained locally in its own worktree, outside #108.

PR #108 at `bde025a5` passes GitHub Typecheck + Vitest and the full Desktop
CI, including native tests and clippy. Vercel preview
`dpl_4iXMzu5XgiSWpRZs4H2CtwN1QcvL` fails after about one second with
`BUILD_FAILED: Resource provisioning failed`, before an application build.
Merge is held for this unresolved deployment check and the separate
production-release boundary. Production auth/founder verification remains
blocked; no production approval or readiness is inferred from green tests.

## Separate security follow-up — manual migration workflow input

The optional migration name was interpolated directly into shell source in a
secret-bearing approved workflow. It now arrives via an environment variable,
is checked against an existing timestamped migration folder, and is passed as
a quoted argument. Local shell fixtures replace Prisma with a harmless command
recorder; no workflow, migration, database connection or production write runs.
The existing explicit APPLY/main/protected-environment gates remain unchanged.
Verification reproduced the prior shell injection using a harmless command
recorder, rejected five malicious/invalid input forms, and preserved the
existing migration name as one argument. YAML parsing and 15 demo contract
tests pass. This candidate is cloud-local and has not run against production.

## Separate security follow-up — sensitive Agent repository evidence

Direct Agent file reads bypassed automatic inspection filtering; sensitive
directory contents also escaped that filename-only filter. A shared pure path
policy now covers direct reads, automatic inspect/search, review capture and
legacy proposal execution. Nine read/inspection regressions and three initial
proposal regressions failed before the repair; multi-file legacy approval is
also covered. Known environment, key, credential and repository-metadata paths
are rejected before credential resolution where possible. Ordinary repository
reads/writes retain scoped tokens and reviewed-SHA checks. This is known-path
protection, not a claim of secret-free source content. No real provider call,
credential change or production mutation is performed.

Sensitive-evidence validation: 530 Vitest files / 5,207 tests and web
TypeScript pass. Desktop/Python code is unchanged from the passing #108
candidate. Live provider and packaged-device validation remain separate.

## Current validation and integration · 2026-10-15

The combined follow-up candidate passes 530 Vitest files / 5,194 tests, web
TypeScript, desktop TypeScript/frontend build and 30 Python CLI tests. Native
Rust checks are unavailable locally. Main remains `9db9f4de`; the only existing
open PR at refresh is unrelated analytics #1. The founder now authorizes
validated PR creation and merge; the earlier no-new-PR notes below describe
historical local milestones. Main merges trigger production Vercel builds, so
the separate production-approval boundary must be resolved before merging.
No migration, production data change or credential change is included.

## Follow-up — current Agent policy at approval

The shared browser/desktop decision boundary now rereads the exact workspace
Agent policy before claiming approval. Missing/disabled identity, a removed
tool and policy-store failure block execution; rejection remains available.
Four regression cases failed before the repair; focused approval tests pass
afterward, including allowed execution and rejection during policy outage.
This is a pre-claim check, not atomic cancellation of already claimed actions.

## Local follow-up — single-file proposal review integrity

Approval execution now requires a valid server-captured single-file review
snapshot before resolving credentials or calling GitHub. Previously a missing
snapshot yielded an undefined expected SHA, bypassing the reviewed-version
comparison supported by the write client. Missing/malformed snapshots now fail
closed with `file_review_required`; reviewed new files retain an explicit null
base SHA and existing files retain their reviewed blob SHA. Multi-file behavior
is preserved. Validation: 530 Vitest files / 5,188 tests and web TypeScript
pass; desktop frontend checks and 30 Python CLI tests passed for the preceding
local milestone and their code is unchanged. Native Rust checks remain
unavailable. This is cloud-local software evidence, not a live provider test.

## Local follow-up — uncertain provider outcomes and retry authority

The continuing cloud-local candidate persists an Airflow dispatch intent before
its non-idempotent provider request. After dispatch begins, a timeout or later
storage failure cannot schedule an automatic replay: it requires reconciliation,
retaining any known provider receipt when possible. A crash or failed hold write
leaves the durable running intent outside automatic retry selection. Failures
before dispatch still use bounded retries. This is conservative duplicate-effect
prevention, not automatic reconciliation or exactly-once provider execution.

Retries also recheck accepted workspace membership and `agent:approve` for the
recorded/current approver; missing/revoked authority and store failure block
execution. Desktop history uses a human-readable uncertain-outcome label,
refreshes after failed responses, and clears its busy state on request/refresh
errors. Approval success copy no longer asserts a completed cloud deployment.
Scheduler counters now distinguish recorded successful actions, failed/uncertain
outcomes, and benign stale claims/disabled rules. Regression tests reproduce
the prior overcount for both new proposals and scheduled retries.
No production data, external operation, release, merge, push, or new PR is
performed. Crash detection and a governed external-receipt reconciliation
journey remain separate work; production login is still externally blocked.

Local validation: 530 Vitest files / 5,184 tests, web TypeScript, desktop
TypeScript/frontend build, and 30 Python CLI tests pass. Native Rust validation
remains unavailable because cargo is absent. No database migration is required.

## Independent follow-up — paused Airflow execution safety

Main `9db9f4de` includes merged PRs #105–#107. Their implementation is not
proof of live production login or external provider validation. The next local
candidate prevents queued/failed executions from dispatching after an operator
pauses a rule or disconnects Airflow. The scheduler excludes disabled rules,
and execution atomically requires the related rule to remain enabled. A pause
does not claim to cancel work already claimed or externally dispatched.
Regression cases reproduce paused queued/retry execution and a pause between
read and claim; an enabled rule retains its existing retry path. No schema
change or production/provider operation is needed for this software repair.
Per the founder's instruction, no new PR is created for this local milestone.
Local validation: TypeScript, 529 Vitest files / 5,165 tests, desktop
TypeScript/frontend build, and 30 Python CLI tests pass. Native Rust checks
remain unavailable because cargo is absent. This candidate is committed only
in the cloud workspace; it is not merged, pushed, deployed, or live-validated.

## Current unified mission · 2026-10-15

The founder's [unified master mission](AXIOM_UNIFIED_MASTER_MISSION.md) now
combines engineering, UX/design, architecture, governance, security, QA and
launch-readiness responsibilities. Preserve the prior mission and established
architecture; do not restart or reserve unfinished review work for another AI.

The [capability and priority matrix](AXIOM_UNIFIED_CAPABILITY_MATRIX.md) records
the initial review against main `ea88095c` (PR #104). The historical ~85% figure
remains unverified and must not rise because a PR exists. Production auth,
database ledger/founder verification, domain promotion, preview provisioning,
exact native builds and live-provider/Stripe validation remain distinct gates.

PR #105 independently repairs browser authority for pending workspace
memberships, matching the desktop acceptance requirement. Its candidate passes
5,156 tests, TypeScript, desktop frontend checks and Python CLI tests locally;
it has not been merged, deployed, or live-validated at this snapshot. No
production migration, cloud mutation, billing activation or release is
authorized by the mission's expanded ownership. Continue safe independent
milestones while production evidence is pending rather than repeating access
requests or duplicating completed implementations.

PR #107 is a second independent operational-safety candidate: atomic Airflow
execution claims prevent competing callers from dispatching the same observed
attempt and preserve a rejection racing with approval. Pending approval needs
an explicit approver. Its candidate passes TypeScript and 5,157 tests locally;
provider dispatches were mocked. Post-dispatch persistence failure/reconciliation
remains open; neither PR establishes exactly-once effects or live validation.

## Historical snapshot — do not use as current main/credential evidence

Updated 2026-10-14 from the current `main` checkout at `d1dc9c9d`.

## Evidence-based snapshot

| Capability | State | Evidence / gap |
| --- | --- | --- |
| Billing and AI-credit reservation lifecycle | CI verified and merged | PR #76 merged in `61b3fee5`; GitHub Test workflow run `38645130441` succeeded. Do not recreate this work. |
| Governed desktop agent | Partial, CI-tested | The desktop Agent has repository/environment selectors, Inspect/Engineer/DeepOps controls, read-only evidence tools, approval-gated proposals, audit rows, governed AI calls, bounded effort budgets, and a per-turn provider-reported usage receipt that never claims settled customer charges. |
| AWS/ECS operations | Partial, CI-tested | The registered agent tool set includes approval-gated AWS deployment proposals. Tenant workflows now serialize a target-specific deployment queue without cancelling an active rollback-capable run. A real nonproduction account, target, and explicit authorization are still required for live validation. |
| Azure/GCP inventory | Source present; live status unknown | Do not represent write execution as available until a registered tool and authorized provider evidence exist. |
| Local dependency validation | Blocked in this environment | The local npm registry cannot be reached. Use GitHub Actions for TypeScript and Vitest validation; do not repeat local network diagnostics. |
| Desktop release build | CI verified | PR #78 restored the approved footer copy; PR #79 makes Desktop CI run when any release-gate input changes. GitHub Desktop CI run `38648628935` passed. |

## Completed independent slice

**Bounded Agent effort budgets.** Acceptance criteria: Inspect has a small bounded read-only decision budget; Engineer retains the balanced default budget; DeepOps has a larger bounded budget; all modes retain the existing governed-AI, workspace-credit, and approval path; no mode claims a provider/model or customer price it cannot verify.

PR #77 merged the initial authority modes and passed GitHub `Test` run `38647204934`. PR #80 merged the bounded-effort follow-up in `9f2401e7`; its GitHub Test run `38650115351` and Desktop CI run `38650115334` passed. No deployment, live billing change, or cloud operation is authorized.

## Recently completed independent slices

**Truthful Agent usage receipt.** PR #81 merged in `46591b6e`. It returns per-turn decision-step and provider-reported token evidence to the desktop while explicitly separating that evidence from settled workspace-credit charges. GitHub Test run `38651830096` and Desktop CI run `38651829889` passed.

**ECS target deployment serialization.** PR #82 merged in `d1dc9c9d`. The checked-in tenant workflow and copyable template serialize runs by role, region, cluster, and service with `cancel-in-progress: false`; a contract test prevents those two workflow sources from drifting. GitHub Test run `38653509460` passed.

## Next operational vertical slice

Live AWS/ECS validation remains externally blocked. To safely validate it, provide: (1) a connected tenant-owned **nonproduction** AWS account, (2) a configured nonproduction environment target and repository workflow, (3) a narrowly trusted GitHub Actions OIDC role, and (4) explicit approval for one bounded test deployment. Until then, do not dispatch a workflow, claim AWS availability, or substitute local cloud credentials. The next software-only work must be a separate readiness or verification contract that does not overlap the already validated workflow surface.

## Added master track: governed AI actual-cost billing

The service already uses the Vercel AI SDK (`ai`) and the Vercel AI Gateway as its only production inference boundary. It records a Gateway generation id per tenant, holds a tenant-scoped AI-credit reservation before a request leaves the service, and reconciles the Gateway's authoritative generation cost into a settled `UsageEvent`. Do not add a second AI SDK/provider path or substitute token estimates for an actual Gateway cost.

The requested next capability is intentionally narrower than a live billing toggle: extend the settled ledger to calculate a deterministic **1.5×** customer price and enforce a hard workspace spend limit, then create replay-safe Stripe usage/invoice mutations only for explicitly enabled test workspaces with a verified Stripe customer and payment authority. Reservations, pending costs, missing gateway costs, unavailable limit state, Stripe failures, and duplicate deliveries must all fail closed; they must never create a customer charge. Test normal, cap, retry, refund/credit, and webhook replay journeys before production approval.

Vercel Workflow and Queues are not selected for this financial path today. The current reservation and database idempotency records are already the authoritative accounting boundary, while Queues is beta and at-least-once delivery would add another reconciliation surface. Vercel Observability can be used for operational diagnosis via existing correlation ids only; no prompts, credentials, or payment data may be exported. Any Vercel platform cost must be measured from the account's plan and observed usage before a customer price is set; it is not provider-attributable AI usage and must not be silently included in the 1.5× model charge.

## Held billing candidates checkpoint

Privacy resilience #123 is merged; its automatic main deployment is READY
(`dpl_B3i6jsefAwdmjz97nvMQe1vGDdn6`). The follow-up billing candidate selector
excludes existing reconciliation holds before LIMIT while preserving all ledger
records, quota, idempotency keys and final worker checks. SQLite and disposable
PostgreSQL 16 fixtures return eligible work behind older held rows. Disabled
accounts, exhausted budgets and repeatedly failing eligible retries remain open
fairness cases. No production SQL, live billing or manual promotion was performed.

## Production-login priority recheck

Highest priority remains actual production login, founder mapping and desktop
pairing. Fresh P2022 evidence confirms missing User.emailVerifiedAt across all
three requested callback types. Protected preflight dispatch still returns
Forbidden; external secure main-branch dispatch/report or agent Actions access
is required. No account mutation, migration, verification bypass or infrastructure
change is authorized by this diagnostic work. Independently, billing candidate
selection now checks account/customer configuration and fresh monthly capacity
before LIMIT, preserving already-reserved retry eligibility and ledger holds.
Real isolated Stripe acceptance and repeated eligible retry fairness remain open.

## Durable retry fairness follow-up

#125 passed exact-head CI and merged. Billing retry rotation now persists an
attempt marker before contacting Stripe and orders by the existing last-update
timestamp. Original reservation time, key, tenant, amount and budget hold stay
unchanged. Five reproduced regressions pass; real SQL rotates waiting work in
SQLite/PostgreSQL. 539 files / 5,348 local tests, TypeScript, desktop build and
30 Python CLI tests passed. Real Stripe test-runtime access and production auth
preflight remain blockers. Desktop focus-verification lifecycle is a new scoped
follow-up, not a claim that native account pairing is accepted.

## Desktop verification lifecycle follow-up

Startup/focus checks now reject superseded responses, credential-context changes
and post-unmount results. Current failure locks the transport but preserves the
saved vault credential; explicit sign-out still clears it. Eight deferred-response
cases cover the scoped coordinator. Server identity/access validation remains
required. Actual production founder login/pairing and macOS keychain acceptance
remain externally blocked; manual sign-in submission races are a separate scope.

## Protected production preflight #2 received

Run 38792352304 completed with diagnostic exit 2: read-only, seven pending
migrations, unfinished workspace-agent identity, nonexistent Organization
reference, missing email-verification schema. Founder account check passed;
platform-admin policy and actual authentication/pairing remain unverified.
A guarded auth-only production proposal and full-history PostgreSQL rehearsal
are prepared in PRODUCTION_AUTH_RECOVERY_PLAN.md. No production mutation or
ledger reset occurred. Backup/target confirmation and explicit scoped execution
approval remain required. Unrelated Agent-policy and financial changes stay
separately gated. #125–#127 are merged with READY automatic main builds.

## Database provider and restore-readiness discovery

Owner confirms both are unverified. Read-only Vercel metadata identifies Resend
and GitHub integrations, not the database; repository provider names are examples.
A sanitized configured-endpoint classification is added to the existing protected
preflight, with no URL/host/database/credential output and no new secret scope.
Provider control-plane backup status and website target equivalence remain
unverified. The documented restore checklist requires provider-specific review
and an approved isolated restore before production approval. #128's proposal
and rehearsal CI passed and its main build is READY; no production migration,
backup/restore, ledger mutation or live billing activation was performed.
