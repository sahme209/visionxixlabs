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

## Clarification: GitHub release operations inside Axiom
The user explicitly wants the daily GitHub release workflow within the desktop app, with automation added progressively. Cover repository/ref selection, PR/MR-style change review (GitHub PR initially), checks, independently authorized merge, workflow selection and declared fields, run/job/log observations, cancellation/rerun when permitted, validation and recovery evidence. This is a roadmap, not a claim these operations are already supported. Existing provider protections remain authoritative; account sign-in/consent or unsupported administration may still require the provider. Do not promise every GitHub feature or bypass protected branches.

## Separate Grok Bot workstream
The user distinguishes Grok Bot from Grok AI/model routing. Official overview https://docs.x.ai/grok-bot/overview describes persistent agents with a cloud computer, cross-app work, durable context and routines. Team architecture https://docs.x.ai/grok-bot/teams-and-enterprises describes controls at model, tool, computer and approval boundaries. Research native Axiom equivalents and whether a documented external integration exists. No public Bot API integration or entitlement has been verified here. Do not conflate this with the existing Grok Multi-Agent aggregate-budget gate; do not provision computers, spend, enable tools or expose accounts under this roadmap item alone.

## Workflow-definition intake increment
The paired metadata read is read-only, repository scoped and byte bounded; the DTO includes repository/ref/path/blob identity. Desktop discards responses when source or credential changes. It does not record an execution authorization. Choice and boolean controls preserve string payloads; numeric values use strict visible syntax, with invalid legacy values retained visibly for correction. Defaults apply only on an explicit button and never overwrite existing values. Undeclared inputs require explicit removal. Invalid manual rows block discovery and are retained; manual fields freeze during discovery. Environment fields currently accept an exact environment name with an explicit note that repository environment choices have not been fetched. Workflow catalogue selection, persisted source binding, verified environment choices and execution-time revalidation remain separate unfinished tasks.
