# Airflow dependency correlation implementation proposal

Status: source-only proposal, 2026-10-16. No schema, scheduler, provider, or execution behavior changes are authorized by this document. Current safeguards and customer acceptance gates remain in [Terraform and Airflow customer acceptance](TERRAFORM_AIRFLOW_CUSTOMER_ACCEPTANCE.md).

## Preserve the existing contract

`AirflowAutomation.dependencyDagIds` currently means: inspect each dependency's latest run, require success, and require a valid logical timestamp at least as recent as the source. This is latest-run freshness, not “latest completed”: a newer queued or failed run blocks, even when an older success exists. Rules without dependencies still support manual runs with null logical dates. Preserve both behaviors by default.

The persisted rule and desktop/API DTO currently contain no correlation choice. `TenantIntegrationConnection.scopesJson` holds connection metadata/scopes, not per-rule scheduling policy. Do not introduce a hidden policy there, reinterpret DAG identifiers, or add an unused correlation kernel.

## Smallest usable opt-in contract

A separately reviewed additive migration would introduce a closed per-rule correlation mode: `latest_run_freshness` as the backward-compatible default, and explicit operator opt-in `same_data_interval`. Its create/edit API, desktop controls, validation, policy evaluation and execution recheck must ship together. Exact logical-date equality, if later requested, is a different policy and must not be described as business-partition equivalence.

Extend the provider DTO to retain nullable `data_interval_start` and `data_interval_end`. An interval is authoritative only when supplied by the connected Airflow API: never derive it from logical date, start time, run ID or wall clock. Airflow 3 manual triggers can have null logical dates and timetable-dependent intervals. `partition_key` is version-dependent and is not a universal Airflow 3 contract.

Strict mode must block missing, partial, malformed or ambiguous metadata and never silently fall back to freshness. Validate timezone-aware instants, calendar validity, precision and boundary ordering; preserve provider timestamp precision when comparing instants rather than truncating microseconds through JavaScript `Date`. Confirm whether zero-length intervals are valid for the connected timetable before specifying their treatment. Define bounded, paginated matching lookup and fail closed on incomplete lookup or competing/retried runs whose precedence is unknown. A newer unrelated interval must neither satisfy nor automatically invalidate the requested interval.

Local rule validation checks the closed mode and dependency constraints. Remote validation checks supported API version, exact interval metadata and actual timetable behavior without triggering a DAG. Connection failures remain blockers, not permission to weaken policy. The selected source/dependency run IDs, intervals and rule revision must be durably associated with the proposal and rechecked before dispatch; approval must not survive a policy revision unnoticed. Existing executor `resultJson` is overwritten during phases and must not be assumed to be an immutable evidence store. Review the smallest durable evidence/revision field alongside the mode migration, rather than adding another disconnected artifact model.

## Compatibility and acceptance gates

1. Implement reader compatibility first: absent legacy mode means existing freshness behavior. Avoid active Prisma selections of new columns before the separately approved migration; authentication-only database repair must not break working Airflow reads.
2. Review additive schema, rollback compatibility and deployment ordering separately from authentication recovery. Preserve existing enum/history checks. No production migration follows from this proposal.
3. Ship explicit create/edit controls and complete server-side validation; reject unsupported modes rather than storing ignored intent. Keep existing rules on freshness. Enable strict correlation only through an operator's per-rule choice after endpoint validation.
4. Exercise actual client parsing against a local HTTP Airflow contract fixture, then source-to-proposal and approval-to-dispatch rechecks: equal instants with offsets, distinct microseconds, malformed/partial intervals, missing logical dates, pagination exhaustion, conflicting retries, policy edits and metadata changes. Preserve all current no-dependency and freshness regressions. These are synthetic regressions, not provider acceptance.
5. In an explicitly authorized nonproduction Airflow 3 environment, inspect real fixture-DAG intervals, correlate the same business slice, demonstrate wrong-slice blocking, obtain approval and observe one governed execution receipt. Capture sanitized run IDs and policy revision. DAG triggers, GitHub dispatch and infrastructure changes require their existing authorization.

Official contracts: [Airflow 3 upgrade guidance](https://airflow.apache.org/docs/apache-airflow/stable/installation/upgrading_to_airflow3.html), [Airflow 3 template context](https://airflow.apache.org/docs/apache-airflow/3.0.0/templates-ref.html), and the connected version's [stable REST API](https://airflow.apache.org/docs/apache-airflow/3.2.2/stable-rest-api-ref.html). Version-specific fields require endpoint verification; this proposal does not prove the customer's installed API supports them.
