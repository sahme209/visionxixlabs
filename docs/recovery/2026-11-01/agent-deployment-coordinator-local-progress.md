# Agent AWS dispatch coordinator local progress — November 1

Local implementation under the approved review/execution separation proposal. The fixed coordinator now includes the eighth closed tool, `trigger_aws_deploy`; no execute route is mounted and this is not activation acceptance.

## Fixed implementation

`agentActionDeploymentExecution.ts` accepts only the coordinator's saved operation source. It compares the saved server-generated restart-target review against the current target before claim, requires the paired original requester and the existing `deployment_dispatch` current-authority profile, and resolves only the captured installation's scoped token. No legacy execution responder, caller approval boolean, bypass flag or configurable provider transport is invoked.

The module reuses the fixed deployment-policy evaluator and the existing deployment reservation, release, settlement and workflow dispatch implementations. Evaluation explicitly requests `legacy_ecs_restart`, retains production requirements, rejects unverified promotion input, and orders repository/policy ties by stable ID. A canonical database policy snapshot must remain unchanged around provider evidence IO. The source commit and policy result are re-evaluated before the actual POST and must match the reserved evidence. Final review/requester/policy/target/connection/reservation SQL authority is delegated to the store's `beforeDeploymentDispatch` as the last authority await; no later authority await precedes the POST.

Reservations use the durable operation ID and the original requester. Reused completed or matching reserved history produces unknown without another POST or hold release. Definite pre-write refusal and explicit definite provider rejection release a newly acquired hold. Lost replies and server errors retain the hold and record unknown. Accepted provider dispatch remains confirmed even if tracking settlement fails. The module calls durable completion once outside the dispatch catch; completion loss cannot trigger another dispatch or second completion.

## Local verification

The new suite first failed because the module did not exist. A regression then reproduced matching reserved history being falsely classified as refused; it passed after changing that case to consumed unknown.

`npx vitest run lib/axiom/agentRuntime/__tests__/agentActionDeploymentExecution.test.ts lib/desktop/__tests__/currentGithubWriteAuthority.test.ts lib/axiom/agentRuntime/__tests__/agentActionExecutionCoordinator.test.ts lib/axiom/agentRuntime/__tests__/agentActionExecutionCoordinatorDatabase.test.ts`: 41 tests passed across 4 files. Log: `work/governance-intelligence/agent-deployment-coordinator-focused.log`.

`npx tsc --noEmit -p work/governance-intelligence/tsconfig.agent-requester-coordinator.json`: exit 0 with the final store method present. Log: `work/governance-intelligence/agent-deployment-coordinator-types.log` (empty on success).

The 16 new tests use the real fixed policy evaluator, reservation/release/settlement functions and workflow transport with simulated provider fetch and simulated authentication/final-store/policy-snapshot evidence. They prove local composition only; they do not establish genuine human review, real provider credentials, live cloud behavior or actual PostgreSQL reservation integration.

Coverage includes positive dispatch with requester/operation binding, target drift before claim, source/policy drift around awaits, final reviewer refusal with zero POSTs, explicit 403 release, lost reply and 503 retention, reused completed/reserved history without redispatch, production fail-closed controls, promotion refusal, deterministic policy ties, tracking failure after acceptance, final authority ordering, and lost durable outcome response without retry.

## Acceptance limits

The provider workflow still dispatches a symbolic branch/tag ref. Matching freshly resolved source evidence to a reservation is not proposal-time immutable SHA or immutable artifact authority. Source may move after the last provider read; this implementation does not claim that symbolic dispatch is immutable. Production legacy restart remains fail-closed where artifact promotion is required.

Actual PostgreSQL final deployment authority tests and snapshot-helper tests are owned by the store change and require their separate receipt. Actual coordinator + quota reservation + final store + provider simulation PostgreSQL journeys remain future work. Focused source types pass with that store method; final independent source review remains required. No full build, deployment, live token mint, provider write, schema/grant change, paid call or commit was performed for this increment. Enrolled scopes continue to refuse without genuine coverage.
