# Apache Airflow integration

Axiom Agent integrates with the stable Apache Airflow 3 public REST API. The desktop app is the operator surface; credentials and Airflow requests stay on the Axiom service.

## Supported flow

1. A workspace administrator opens **Batch automation → Connection**.
2. They enter an HTTPS Airflow origin and either Airflow username/password credentials or a managed bearer token.
3. Axiom validates the live endpoint before storing the credential encrypted and scoped to the workspace.
4. Users with read access can select DAGs, inspect recent runs, and monitor status.
5. Users with deployment execution access can manually trigger a DAG.
6. Workspace policy managers can create completion- or schedule-based automations using DAG, dependency, repository, branch, and environment selectors.
7. Read-only completion records may run automatically. GitHub and cloud changes always stop for a human approval.
8. The scheduler retries transient action failures, emits audit events and configured webhook notifications, and reconciles deployment rollback state from the existing AWS ECS workflow.

The integration does not store DAG configuration or task logs. It persists only secret-free run identifiers, timestamps, states, automation decisions, and linked deployment evidence.

## Airflow requirements

- Apache Airflow 3 with the public API enabled.
- A publicly reachable HTTPS origin such as `https://airflow.example.com`. Paths, URL credentials, redirects, localhost, private network ranges, link-local addresses, and private DNS suffixes are rejected.
- An Airflow identity limited to the DAG read and trigger permissions the workspace needs. Do not use an Airflow administrator credential.
- For username/password mode, `/auth/token` must issue a JWT accepted by `/api/v2`.
- For managed-token mode, supply a service-managed bearer token and rotate it according to the organization's credential policy.

Optionally set `AIRFLOW_ALLOWED_HOSTS` to a comma-separated exact hostname allowlist. When configured, Axiom refuses every other Airflow host.

## Axiom deployment requirements

- Apply the Prisma migration `20261008170000_add_airflow_governed_automation`.
- Set `CRON_SECRET` to a strong random value so `/api/cron/airflow-automation-tick` can run from the five-minute Vercel schedule.
- Set `CREDENTIAL_ENCRYPTION_KEY` (or the existing `STARTER_TOKEN_SECRET`) to at least 32 characters.
- Keep the existing GitHub App, environment deployment targets, AWS OIDC workflow, workspace roles, and webhook subscriptions configured for any downstream actions selected by users.

The scheduler is idempotent per automation and Airflow run. Multiple ticks cannot create duplicate action proposals for the same rule/run pair.

## Governance behavior

- `workspace:read` can inspect connection status, DAGs, runs, automations, and execution history.
- `connections:manage` can connect or disconnect Airflow.
- `deploy:execute` can manually trigger a DAG.
- `policy:manage` can create, pause, or enable automations.
- `agent:approve` can approve or reject a proposed GitHub or deployment action.
- Production deployment proposals still pass the standard environment policy evaluator. Airflow never grants an administrative bypass.
- Connection, trigger, proposal, approval, rejection, success, failure, deployment, and rollback outcomes are recorded in the tenant audit trail.

## Failure and recovery

- A failed endpoint validation never marks a connection active.
- Disconnecting Airflow disables its automations.
- Missing or stale dependency successes keep the action blocked; they do not silently pass.
- Failures before a provider action starts retry up to the rule's configured
  limit with a bounded delay. A provider timeout or a persistence failure after
  dispatch requires reconciliation instead of automatic replay.
- ECS stability failure and rollback remain owned by the tenant's OIDC-authenticated GitHub Actions workflow. Axiom reconciles that workflow result into the Airflow automation execution.
- Operators can pause a rule at any time without deleting its execution or audit evidence.
- Paused or disconnected rules cannot start queued actions or retries. The
  executor rechecks the enabled rule when it atomically claims an attempt, so
  a pause after its initial read still blocks the provider call. This does not
  cancel an operation already claimed and possibly dispatched externally.

## Execution claim safety · 2026-10-15

Each action must atomically claim the tenant execution's observed status and
attempt number before contacting GitHub or a cloud workflow. Competing callers
cannot execute the same observed attempt, and a rejection after the initial
read prevents the stale approver from dispatching it. Consuming a pending
approval requires an explicit approver; the scheduler cannot approve it merely
by calling the executor. Regressions exercise concurrent callers, rejection
races, stale failed attempts, and the authorized approval path with mocked
provider calls. No real Airflow/GitHub/cloud operation was performed.

### Uncertain outcomes and current retry authority

The executor persists a dispatch intent before its non-idempotent PR/workflow
request. Once that request starts, an unconfirmed response or later persistence
failure leaves `needs_reconciliation` with no scheduled retry. A known provider
receipt is retained when storage is available. This state is not eligible for
another executor claim. If the process or storage fails before the hold can be
saved, the already durable `running` intent also remains outside automatic
retry selection. Failures before dispatch retain bounded retries.

Because the current provider adapter does not distinguish every definitive
rejection from an ambiguous network failure, even an unsuccessful response after
dispatch starts conservatively requires review. This trades automatic recovery
for protection against duplicate external effects. Inspect the actual external
result before authorizing further work; no automatic reconciliation/reset
operation is supplied by this milestone, and no manual database edit is implied.
Crash detection, automatic receipt lookup, and a governed reconciliation journey
remain separate work. This is not an exactly-once or live-validation claim.

Scheduled retries recheck a stored approver against the execution's workspace:
membership must still be accepted and retain `agent:approve`. Revoked/pending
memberships, a role without that capability, or an unreadable membership store
block execution before the claim or provider request. An approval-required rule
without a recorded approver cannot auto-approve itself. Restoring legitimate
authority uses existing workspace governance; this code never grants a role.

Desktop history labels an uncertain result as requiring review, refreshes after
both successful and failed action responses, and releases its busy state if a
request or refresh fails. Provider-dispatch acceptance is not presented as
proof of a completed cloud deployment.

## Production verification checklist

- Connect a non-production Airflow 3 instance with a least-privilege test identity.
- Confirm DAG listing, run history, and one manual DAG trigger.
- Create a read-only completion automation and confirm one idempotent execution.
- Create a PR automation and verify it remains pending until a permitted human approves it.
- Create a development deployment automation and verify the selected Axiom environment resolves to the expected AWS target.
- Exercise a failed deployment and confirm the GitHub workflow rollback and reconciled Axiom status.
- Confirm audit events and configured webhook deliveries contain identifiers and outcomes but no Airflow credential or DAG configuration.

Scheduler tick counters record successful executor outcomes as actions. Failed or
unconfirmed outcomes count as errors; a competing claim or disabled rule is a
no-op. An action count does not establish that a cloud deployment completed.

Airflow deployments use the existing serializable organization deployment
reservation before dispatch, keyed by the Airflow execution id. Exhausted or
unavailable allowance blocks the provider request. A recorded deployment is
linked without dispatching again; accepted dispatch settles that same reserved
row. If intent persistence fails before dispatch, the new reservation can be
released. Once dispatch begins, uncertain outcomes retain both the reservation
and its reference in the action intent/receipt for reconciliation. Existing
plan limits, pricing and production-approval policy remain unchanged.
