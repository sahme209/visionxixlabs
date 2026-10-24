# Release Workspace: intake to governed execution

## Intent
An application engineer or DevOps engineer starts from a change ticket, even when they do not know repository or pipeline URLs. Axiom resolves that knowledge with recorded application ownership and connected provider evidence, watches exact Airflow batches, and presents the next authorized action without keeping a provider tab open. Keep the compact, restrained desktop presentation and preserve the accepted cockpit.

## Approach
Extend existing DeploymentRequestsView, application catalog, paired desktop service, Airflow scheduler and approval/execution records. Replacing the release engine would discard existing safeguards; a visual-only wizard would not solve the operational work. The user delegated routine design choices and requested no intermediate design checkpoints. This document records implementation decisions, not new permission to execute releases.

## Flow
1. Intake: ticket, application/client, window and owner. Unknown technical details must become explicit resolution work; never guess a repository.
2. Resolve: choose connected repository/ref and pipeline. Different workflows expose different declared inputs; bind schema and values to the exact reviewed source. Ordinary users use labelled controls; JSON is an advanced fallback.
3. Wait: record specific Airflow DAG/run and matching logical date dependencies; durable server observation continues when desktop closes. Show waiting, failed, stale and ready separately, with completion notification when available.
4. Review: immutable repository/ref/workflow/input/target/dependency evidence. PR merge and workflow dispatch are separate capabilities/approvals; no inferred merge authority.
5. Execute once: recheck permissions, window, dependency freshness, source and target before provider action. Preserve ambiguous-outcome recovery; never blindly redispatch.
6. Validate and recover: workflow success alone does not prove application health. Preserve technical/functional checks, rollback evidence and audit timeline.

## Existing foundation and gaps
Existing intake saves string-valued workflowInputs; currently raw JSON is required. Airflow automationTick already detects terminal runs and deduplicates executions; executor revalidates source/dependencies/connection and requires governed deployment review. These are not yet one release-request flow. Existing deploy executor targets a configured ECS workflow; arbitrary GitHub workflows or Azure pipelines must not be claimed supported until implemented and verified.

## Initial independent deliverable
Replace mandatory raw JSON entry with editable named input rows, preserving the exact string-valued payload and an advanced JSON recovery path. Validate duplicates/blank keys/malformed values; do not silently drop values. No provider discovery or execution is implied by manually entered fields. Subsequent deliverables add authenticated schema discovery, intake resolution and exact batch bindings.

## Constraints
No new provider credentials, paid inference, broader Agent grants, cloud purchases, CI budget increases, production database migrations or publication bypass. Existing remaining acceptance gates stay open. No new dependencies without need. Tests must distinguish local fixtures from actual provider evidence.
