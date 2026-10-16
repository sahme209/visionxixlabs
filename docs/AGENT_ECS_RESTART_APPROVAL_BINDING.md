# Agent ECS restart target approval binding

The legacy `trigger_aws_deploy` tool restarts an existing ECS service task definition. It does not build, deploy, or promote the selected source artifact. The pure ECS v2 contract remains a separate, unconnected implementation slice.

## Fixed customer/security boundary

Previously, a pending Agent proposal bound an environment ID but not its actual AWS deployment target. Reconfiguring that environment before approval caused the old proposal to dispatch a different role, region, cluster, or service without presenting that target to its reviewer.

The proposal preparation boundary now discards all caller/model `_review` data and reads the tenant-owned environment and target. It records the actual environment ID/tier, target ID/provider/updatedAt revision, role ARN, region, cluster, and service under `ecs_restart_target`. The existing canonical proposal digest covers this server-owned evidence. Browser governance and desktop approval cards display the target and restart limitation before approval.

Execution refuses absent/historical or changed target evidence; it never creates a fresh binding for an old approval. The target is checked before GitHub policy/token work and again after policy/quota reservation IO immediately before dispatch. Dispatch arguments come from the reviewed snapshot. A confirmed pre-dispatch mismatch releases the newly claimed reservation; read failures fail closed. Tenant membership, separate approver, approval expiry, Agent tool allowlist, production policy, GitHub scope, and quota guards remain intact. Proposals lacking target review require a new proposal and independent approval.

## Evidence and limits

Regression tests prove historical proposals and changed role/region/cluster/service/tenant/tier/target identity/revision cannot dispatch, including reconfiguration during reservation IO. Ten such tests dispatch incorrectly against the previous executor. Tests also prove caller review replacement and actual browser/desktop target rendering. All provider operations are mocked.

`DeploymentTarget.updatedAt` is the existing configuration revision. There is no associated cloud credential connection foreign key/version in this schema; this change does not invent one or attest IAM trust, STS identity, workflow contents, cloud ownership, application health, or image recovery. Target configuration read/recheck and GitHub dispatch are not an atomic distributed transaction. A change after the final read remains a race requiring the durable operation/target concurrency mechanism in the ECS v2 plan. Snapshot arguments prevent the reconfigured target from replacing the approved dispatch arguments, but do not prove continued authority after that read. Source branch movement and immutable artifact binding are also separate v2 prerequisites. No production deployment or real provider acceptance is claimed.

Next: integrate durable source/artifact/target reservations and receipts under the reviewed ECS v2 plan, then perform separately authorized sandbox rollout, health, and recovery acceptance. No schema or production change is part of this patch.

## Clean CI dependency boundary

The real desktop approval-card rendering test imports the notification module
transitively. Root web TypeScript CI initially failed because the root install
lacked `@tauri-apps/plugin-notification`; local desktop dependencies had masked
that missing declaration. The root now declares the exact desktop plugin version
`2.4.0` as a dev dependency, alongside its existing Tauri API and shell test
dependencies. No ambient stub or runtime behavior change is introduced. An
isolated three-package `npm ci --ignore-scripts` from the exact root lock entries
typechecked the actual notification source without desktop dependency fallback.
Focused approval/pairing rendering regressions passed 24 tests. Exact-head CI must
pass again after this correction; the earlier full-suite/build evidence does not
make the failed CI head acceptable.

## Bounded desktop receipt observation plan (2026-10-16)

The approved desktop change closes only the Agent approval-to-observation gap.
`AgentChatView` will refresh the existing redacted conversation after a decision
and restore restart receipts on conversation hydration. A small receipt view will
render only whitelisted execution identity/status fields, reuse
`DeploymentWorkflowEvidence` / `deploymentObservationState`, and offer manual
refresh through the existing tenant-authorized execution endpoint. Approval DTO
typing will match the existing route; raw action result JSON will not be added to
the approval response. No polling, approval-policy change, dispatch retry or new
execution authority is introduced.

Regression acceptance covers queued/tracking-unavailable receipts, reopen,
malformed/mismatched receipt refusal, manual observation, failed observations,
conversation switches, unmounts and credential changes. Tests must distinguish
workflow dispatch from ECS outcome and application health. Existing sanitization
and paired-session tenant enforcement remain server-owned. Native/browser,
provider dispatch and actual AWS service acceptance remain unverified.

### Implemented source boundary and focused UI evidence

The Agent now recovers approved restart receipts from the existing redacted
conversation and offers manual canonical workflow observation. Only whitelisted
identity/status fields are rendered; arbitrary action result fields are not
printed or added to approval responses. Queued or tracking-unavailable dispatch
is never described as a completed ECS restart. Reopened server tool-result turns
for successful restart requests receive the same truthful workflow-only wording.
Existing artifact/health/image-recovery evidence remains explicitly unverified.

Conversation selection and creation invalidate old UI ownership, not the durable
server decision. All restore/open/message/decision reads capture the credential
context and conversation generation; the current request ID must still match
before publishing results. Credential/base changes remount an opaque scoped Agent
session, clearing prior content and busy flags before a fresh loader can publish.
Deferred-response regressions cover approval followed by navigation, reopen,
reverse selection completion, credential changes during restore/message refresh,
and a populated old session with a pending send followed by successful fresh
session loading/sending. Receipt refresh is manual; no polling or retry occurs.

Sixteen focused regressions across the actual React Agent/receipt components and
existing approval target previews pass. Transport responses in these component
tests are controlled fixtures; they are not real browser/native interaction,
actual Next/PostgreSQL UI transport, or provider acceptance. The separate local
HTTP backend evidence must not be reused as proof of this new UI click path.
