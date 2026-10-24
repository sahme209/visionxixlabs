# Release Workspace Implementation Plan

> Execute task by task with superpowers:executing-plans; user requested no routine checkpoints. Do not create parallel agents except authorized review.

**Goal:** Connect release intake, provider-specific pipeline fields, exact Airflow readiness and governed execution in one compact desktop workflow.

**Architecture:** Extend current paired-session request records and Airflow executor. Preserve server authority, immutable review binding and exactly-once dispatch recovery. Build useful independently verified increments.

**Tech Stack:** Existing React/TypeScript desktop, Next service, Prisma/PostgreSQL and GitHub/Airflow clients.

**Spec:** docs/superpowers/specs/2026-10-24-release-workspace-design.md

## Constraints and review focus
No deployment/merge authority implied by this feature request. Preserve cockpit and recovery backups. No new credentials/spending/grants. Reject malformed/duplicate input names without dropping data; retain unknown values. Handle source changes, disconnected providers and stale Airflow runs honestly.

## Tasks
- [x] Workflow input editor: tests for string roundtrip, duplicate/blank names, invalid JSON recovery, add/remove fields; implement desktop/src/components/WorkflowInputsEditor.tsx and use in DeploymentRequestsView. Keep legacy JSON storage/server validation. Verify focused tests, desktop TS/build, review and native UI.
- [ ] Authenticated workflow discovery: read selected tenant repository workflow at exact ref; bounded metadata schema and declared input controls; validate choice/boolean/number/environment fields, required/defaults and unsupported constructs. No guessed schemas or arbitrary URLs.
- [ ] Intake resolution: application/ticket first, record missing repository/pipeline as owner resolution; retain existing complete execution controls before approval.
- [ ] Release dependency binding: connect exact Airflow run/logical-date dependencies to request version, durable observation, readiness notification and timeline. Reuse scheduler/executor and test stale/reconnect/duplicate/restart cases.
- [ ] Governed provider execution: separate reviewed merge and dispatch actions; select arbitrary verified workflow inputs only after source/authority checks. Azure adapter remains unavailable without authenticated configuration. Test ambiguous dispatch and recovery.
- [ ] Full acceptance: actual allowed providers, independent reviewer, visible native checks, exact-source release gates and latest signed installer publication gates. Do not substitute fixtures for live acceptance.
