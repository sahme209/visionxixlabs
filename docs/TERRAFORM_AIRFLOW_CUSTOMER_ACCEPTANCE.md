# Terraform and Airflow customer acceptance

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
