# Governed ECS customer journey: execution boundary and acceptance gaps

Reviewed 2026-10-15. This is an implementation/fixture audit, not a live cloud acceptance certificate.

## Implemented boundary correction

The checked-in `axiom-deploy-aws-ecs.yml` and exported tenant workflow template now bind cluster/service inputs through job environment variables and the captured rollback task definition through the rollback step environment. Quoted shell expansions preserve literal argument boundaries. Caller-controlled GitHub expressions must never be embedded directly in shell source: shell substitutions and quotes in a target could previously execute on the OIDC-authenticated runner. Role/region expressions remain action inputs, not shell source.

`lib/releaseops/__tests__/awsEcsWorkflowExecution.test.ts` executes the actual template's capture, update, wait, and rollback Bash scripts against a local fake AWS binary. It checks literal arguments with command-substitution/quote payloads, captures the rollback output, verifies that successful rollback still reports failed deployment, and propagates failed rollback stabilization. All three new cases fail against the previous template and pass with the correction. Existing parity tests ensure the checked-in workflow equals the tenant template.

No AWS calls, GitHub dispatch, infrastructure changes, or credentials were used. Tests simulate Actions expression expansion and AWS responses; they do not prove AWS IAM, ECS health, GitHub protection, or customer acceptance.

## Integrated customer path and remaining dependencies

| Stage | Existing implementation/evidence | Remaining acceptance or engineering gap |
|---|---|---|
| AI proposes a deployment | Agent tool/runtime routes `trigger_aws_deploy` into approval execution | Actual authenticated customer proposal/approval not verified against provider accounts. |
| Tenant identity and target | `actionApprovalResponder.ts` checks organization-owned environment and target; tenant-scoped GitHub installation token | Customer GitHub installation and bounded AWS role/trust must be supplied and verified privately. |
| Source governance | `deploymentPolicyGuard.ts` resolves source, checks configured CI/review/promotion; production requires controls | Resolved commit is recorded, but workflow dispatch uses a mutable source ref. Need immutable workflow/artifact binding before claiming exact approved source execution. |
| Dispatch | Durable deployment reservation protects uncertain/non-idempotent dispatch outcomes | Actual GitHub dispatch/run tracking reconciliation remains provider acceptance work. No live dispatch was attempted. |
| ECS operation | Workflow assumes OIDC role, captures current task definition, forces restart, waits for service stability | Restart does not build/push image or register a new task definition from approved code. A successful restart is not proof approved code was deployed. Artifact build/digest/task-definition binding is missing. |
| Rollback | Failed stabilization reselects captured task definition and waits; workflow remains failed | With mutable tags, old task definition may pull new image bytes. Image digest and previous deployment artifact identity must be verified. Real induced failure/rollback requires approved sandbox. |
| Airflow dependency | `automationExecutor.ts` rechecks accepted approver membership/capability, claims attempt, evaluates policy and reserves dispatch | Requires real DAG completion, connection, retry/reconciliation evidence; deploy is the same restart-only ECS workflow. Separate Airflow workstream owns implementation. |
| Terraform | Plan/governance surfaces exist elsewhere in product | This ECS workflow does not run Terraform. Actual reviewed-plan/apply/state-lock acceptance is a separate milestone; do not infer completion from ECS tests. |
| AWS/Azure/GCP website deployment | `lib/deploy/provider.ts` accepts provider choices | Both public functions route AWS/Azure/GCP choices to Vercel. This is an implementation gap, not just missing credentials. Placeholder private functions are not live adapters. |

## Approval and trust boundary limitations

Axiom's Agent/Airflow application guards do not protect a repository operator who directly dispatches the GitHub workflow. The workflow currently has no GitHub protected environment declaration or independently verifiable Axiom approval receipt. GitHub repository/Actions permissions, protected workflow changes, and AWS role trust/permissions are therefore required controls. Do not claim that every AWS execution necessarily passed through Axiom approval. Adding a protected environment, OIDC trust change, or role permissions requires the existing infrastructure approval gate; this change does not create or alter them.

The current concurrency key contains role ARN as well as target strings. It serializes identical dispatch tuples, but different roles or equivalent cluster/service identifiers can name the same underlying ECS service. Cross-role/canonical-target serialization is not established by these tests.

## Next safe milestone

1. Resolve source/artifact identity contract across proposal, approval, execution reservation, workflow, image digest, and task definition; fail closed if not bound.
2. Create a customer acceptance manifest for a separately approved nonproduction account/repository/service, including IAM scope, image digest, initial task definition, health checks, and rollback expected result.
3. Exercise real customer identity → GitHub installation → AI proposal → approval → immutable artifact deployment → failed-health rollback → audit reconciliation in that approved sandbox. Do not use production login recovery as authority to dispatch cloud workloads.
4. Record provider receipts and observed artifacts separately from fixture results. Continue Azure/GCP adapters and Terraform/Airflow workstreams independently.

No production changes or new cloud execution permission are implied by this document.
