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
- Set `CRON_SECRET` to a strong random value so `/api/cron/airflow-automation-tick` can run only from an authenticated scheduler.
- The checked-in Vercel schedule is a once-daily safety tick so the project remains deployable on every Vercel plan. For production schedules that need minute-level dispatch, use a Vercel Pro cron or another trusted scheduler to call the same endpoint at the required cadence with `Authorization: Bearer <CRON_SECRET>`. The tick is idempotent, so retries and overlapping invocations cannot duplicate a rule/run execution.
- The coordinator uses a 60-second function budget and persists progress per rule. Larger installations should invoke it frequently rather than increasing the request lifetime; a subsequent tick safely resumes remaining work.
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
- Action failures retry up to the rule's configured limit with a bounded delay.
- ECS stability failure and rollback remain owned by the tenant's OIDC-authenticated GitHub Actions workflow. Axiom reconciles that workflow result into the Airflow automation execution.
- Operators can pause a rule at any time without deleting its execution or audit evidence.

## Production verification checklist

- Connect a non-production Airflow 3 instance with a least-privilege test identity.
- Confirm DAG listing, run history, and one manual DAG trigger.
- Create a read-only completion automation and confirm one idempotent execution.
- Create a PR automation and verify it remains pending until a permitted human approves it.
- Create a development deployment automation and verify the selected Axiom environment resolves to the expected AWS target.
- Exercise a failed deployment and confirm the GitHub workflow rollback and reconciled Axiom status.
- Confirm audit events and configured webhook deliveries contain identifiers and outcomes but no Airflow credential or DAG configuration.
