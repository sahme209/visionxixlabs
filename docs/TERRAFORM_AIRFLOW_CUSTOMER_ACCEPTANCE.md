# Terraform and Airflow customer acceptance

## Inactive saved-plan artifact review boundary

The desktop deployment request's **Review Terraform evidence** panel uses paired
read-only list/detail endpoints. Lists select only bounded metadata; a selected
detail checks tenant/request version, expiry and authenticated artifact bytes,
then derives a sanitized summary without exposing configuration, state or values.
An internal owned fixture reader captures the exact binary's own `show -json`
using an executable digest/version check, private snapshot and isolated environment.
No caller-supplied JSON or legacy lead/HCL approval creates this artifact authority.

Storage remains a proposal outside Prisma migration discovery; current model
reads gain no columns. Missing/partial/altered schema or marker fails closed.
There is no active customer plan producer, current backend/target attestation,
approval binding, collector/upload endpoint, signing or apply action. Approval
is explicitly unavailable. Existing ECS review machinery and all legacy apply
kill switches are unchanged. See [implementation plan](TERRAFORM_SAVED_PLAN_REVIEW_PLAN.md).
[Owned acceptance evidence](mission/local-terraform-saved-plan-http-acceptance.json) at `62e47d94` records genuine CLI, PostgreSQL and paired HTTP checks with verified cleanup. It cannot establish cloud
backend locking, provider credentials, apply/recovery or packaged native behavior.

Reviewed 2026-10-15. This is implementation evidence, not evidence of a completed provider-backed customer journey.

## Airflow readiness and governed execution

The Airflow 3 client uses `/api/v2`, tenant-encrypted connection credentials, bounded requests, and redirect refusal. Scheduled DAG triggers use the existing deterministic occurrence identifier and reconcile a 409 against the exact run; that idempotency implementation is retained.

Dependency-gated proposals require successful dependency runs whose valid logical timestamps are at least as recent as the source's valid logical timestamp. Missing or malformed timestamps cannot establish freshness and block proposal/dispatch. In particular, an Airflow 3 manual run with `logical_date: null` must not inherit permission from an unrelated historical success. Rules without dependencies retain manual-run support. This is a freshness gate, not proof that upstream and downstream share a business partition: exact data-interval correlation is still missing. A null-date dependency workflow needs an explicit reviewed correlation policy before enabling execution; do not invent a timestamp or disable dependencies to bypass the gate.

A confirmed missing contract remains: policy evaluation/reservation records a resolved commit, but workflow dispatch uses the mutable configured branch/tag. Do not replace the GitHub workflow-dispatch ref with an arbitrary SHA or add inputs to customer workflows without a versioned capability contract. The existing ECS workflow restarts a service; workflow checkout identity alone does not prove deployed artifact identity. Approval-to-dispatch commit and artifact binding must be implemented and accepted before claiming immutable deployment execution.

Existing claim safety remains: accepted workspace approver authority is reread; the exact execution status/attempt is atomically claimed; dispatch intent persists before provider action; uncertain outcomes pause in `needs_reconciliation` (or durable `running` after storage failure), retain budget holds and receipts, and are not replayed automatically. Completed workflow/rollback observation is reconciled separately. A successful dispatch is not successful deployment acceptance.

Regression evidence: `automationTickCounts.test.ts` exercises missing/malformed/stale dependency dates, equal/newer successes, and no-dependency manual-run behavior through proposal and executor boundaries. `automationExecutorClaim.test.ts` retains concurrent claim, approval revocation, durable intent, unknown-outcome and quota tests. Providers are mocked; no real DAG, PR, dispatch, or infrastructure operation was performed.

## Terraform: missing engineering versus external access

`lib/terraform/runner.ts` is a legacy lead/starter-token path. Live apply is disabled by default with `TERRAFORM_LEGACY_APPLY_ENABLED`; the tenant orchestration boundary independently keeps apply disabled. Preserve those gates.

The existing runner generates a textual plan, then would run a fresh `terraform apply -auto-approve` if its legacy flag were enabled. It does not persist a saved binary plan, bind approval to a plan digest and tenant/environment/credential identity, atomically consume current role authorization, or establish state lock/recovery evidence. Those are missing engineering requirements, not merely missing cloud credentials. Do not enable either apply flag as an acceptance shortcut. Plan/refresh and provider initialization may contact external services; this audit did not run them against customer accounts.

Before a Terraform execution milestone can be claimed, implement the canonical tenant executor with saved-plan artifact integrity, approved target/credential binding, current approver capabilities, exclusive claim/state locking, bounded execution and explicit unknown-outcome reconciliation. Then validate in an explicitly authorized disposable nonproduction account and account for sensitive plan/state artifacts. A Terraform rollback is a separately planned and approved change; no generic automatic reversal is promised.

## Next real acceptance gate

After application authentication/schema recovery, use an authorized isolated tenant with an Airflow 3 endpoint, fixture DAGs and tenant-scoped GitHub installation. Confirm connection, actual logical dates, dependency success/failure blocking, pending approval, current approver authority, exactly one workflow receipt, successful deployment observation and an explicitly authorized rollback/failure case. Capture sanitized provider run IDs, target identity, commit and audit linkage. Production infrastructure changes, arbitrary DAG triggering and Terraform apply are not authorized by this document.

## Desktop manifest authority follow-up

Source review found that `app/api/desktop/handoff/route.ts` signed caller-supplied plan, policy, approval and checksum claims without authoritative artifact resolution. The issuing route now refuses every signed operation after existing authentication/configuration checks; it no longer substitutes an identifier hash for plan bytes. Boundary regressions preserve the unsigned remediation preview and tenant-scoped approved HCL export. This is containment, not completion of signed artifact delivery or local execution. Server-owned artifact bytes, exact approved digest/revision, tenant/target/backend/state binding and durable grant consumption remain missing; local execution stays disabled. Unknown external clients of the signed issuing route receive an explicit policy refusal.

## Current-condition recheck before writes

The existing freshness contract now applies at dispatch as well as proposal. Before claiming an execution or resolving GitHub credentials/reserving deployment allowance, write actions reload the tenant's active Airflow connection, fetch the exact source run, and require its original terminal state and configured success/failed/any condition still hold. Dependency latest-run success/freshness is rechecked through the same function used by the scheduler. Invalid/unavailable evidence leaves the execution unclaimed; an old proposal is not sufficient permission to write. No-dependency null-date manual runs and read-only `none` actions retain their prior support.

After remote reads, the connection ID/status/updatedAt binding is reread and the rule connection/revision is fenced in the existing atomic execution claim. These are current-condition checks, not a distributed snapshot or lock on Airflow: remote state can change after observation, and the connection row is not joined atomically to the claim because the existing schema has no such relation. No provider write has started on these refusals, so they are not mislabeled as unknown dispatch outcomes. Unknown-outcome handling after actual writes remains unchanged.

`automationExecutorClaim.test.ts` demonstrates that source failure, dependency failure or unavailable Airflow after proposal blocks writes; these regressions failed against the previous executor. It preserves existing concurrent claims, quota/receipt safeguards, configured failure triggers, null-date manual runs and read-only behavior. Provider calls are synthetic in these tests; a real authorized Airflow/customer execution remains unverified.

Approver accepted membership/capability is checked both before remote Airflow reads and again immediately before the claim. Revocation during those reads blocks without consuming the claim, resolving a GitHub token or reserving allowance. The final authorization read is not an atomic lock on later membership changes; that residual post-read race remains explicit alongside the provider/connection observation limits.
