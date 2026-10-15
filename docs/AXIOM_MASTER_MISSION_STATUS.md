# Axiom Agent master-mission status

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
