# Immutable ECS release acceptance plan

Reviewed source: `99abab9f` (PR #141). This document records an unimplemented release contract and staged dependencies. No workflow, schema, provider, production database or routing changes were executed for this plan. Local tests are not customer/provider acceptance.

## Current operational boundary

| Surface | Existing evidence | Actual guarantee / missing requirement |
| --- | --- | --- |
| ECS workflow | `.github/workflows/axiom-deploy-aws-ecs.yml`, matching `lib/releaseops/awsEcsDeployWorkflowTemplate.ts` | Captures current task-definition ARN, calls `update-service --force-new-deployment`, waits for services-stable. There is no build, image digest or new task-definition input. This is a service restart, not deployment of the selected source commit. |
| Recovery | Same workflow captures previous ARN and restores it after failed stabilization | ARN restoration is attempted; mutable image tags can resolve differently. Same-ARN rollback is not proof of previous image recovery. Services-stable is not application health. |
| Agent | `lib/axiom/agentRuntime/actionApprovalResponder.ts`, `tools.ts`, `proposalIntegrity.ts` | Policy resolves source SHA and reservation stores it; dispatch sends mutable sourceRef and only role_arn/region/cluster/service. Action digest protects supplied args, which contain no artifact manifest. Current tool description overstates source-to-deployment binding. |
| Desktop | `app/api/desktop/environments/deploy/route.ts` | Policy, production controls, reservations and uncertain-dispatch protection exist, but same four-input workflow dispatch does not bind the recorded source SHA to running software. |
| Airflow | `lib/integrations/airflow/automationExecutor.ts` | Human production approval, policy, reservation and uncertain-outcome handling exist. Same four-input dispatch; success of dispatch is not release/health acceptance. Existing rollback wording must be qualified when reporting this path. |
| Website release | `app/api/dashboard/release-deploy/route.ts` | Dispatches same restart workflow using release.commitSha or default branch as ref; no artifact. A raw commit SHA as workflow_dispatch ref must not be assumed supported (documented branch/tag contract). Lifecycle start_deploy currently happens AFTER dispatch, allowing dispatched_but_lifecycle_transition_failed. Eligibility/claim must precede side effects. |
| Promotion | `lib/releaseops/deploymentPolicyGuard.ts` | Prior completed successful execution and matching source SHA are checked. Same source can produce different images; immutable artifact identity and health evidence are absent. |
| Durable receipt | `DeploymentExecution` in `prisma/schema.prisma`, `deploymentExecutionResponder.ts` | Stores source/ref/run identity and status, not approved artifact manifest, observed image/task-definition digests or application health proof. A successful Actions run alone cannot close release acceptance. |
| Existing regression infrastructure | `lib/releaseops/__tests__/awsEcsWorkflowExecution.test.ts`, `awsEcsDeployWorkflowTemplate.test.ts` | Executes actual template shell against fake AWS and enforces template/file parity. This is useful behavioral evidence, without contacting AWS. |

The tenant AWS desktop enrollment/inventory vault does not authorize this release path automatically. No legacy credential adoption or generic Agent fallback is part of this plan.

## Versioned approved contract

Keep the installed four-input workflow compatible as explicitly named **service restart**. Introduce a separately discoverable `axiom-release-aws-ecs-v2.yml` capability and matching source template. Do not silently add required inputs to installed legacy workflows, infer capability from filename alone, or fall back from a rejected release into a restart.

The server-owned, canonical immutable manifest must bind:

- Protocol version, organization/environment, repository identity, operation ID, expiry, and required approval/governance snapshot.
- Exact resolved source commit (40 hex characters), trusted workflow identity/blob revision and build run/attempt provenance. Source branch/tag is explanatory metadata, not artifact identity.
- Verified build attestation identifying source, builder and immutable image digest. An arbitrary OCI source label or caller-supplied hash alone is insufficient provenance.
- Expected AWS account, partition, region, role, cluster and service; target configuration revision.
- New fully qualified task-definition ARN, canonical task-definition content digest and **every** container image pinned as registry/repository@sha256, including sidecars. Account/region must match the intended target. Environment-specific task definitions can differ while promotion preserves the approved image set.
- Expected current task-definition ARN/content digest and digest-pinned images as the rollback baseline. If current images are mutable or baseline changes before execution, block the release for renewed review; do not claim exact rollback.
- Bounded stabilization and explicit application health policy, including trusted probe destination/ownership, timeout and expected result. Do not let arbitrary manifest URLs create an SSRF probe capability.

Manifest digest joins the proposal integrity digest, idempotency identity, quota reservation, promotion evidence and receipt. Approval must display the artifact, source, exact target and rollback limitations. Resolve/recheck mutable source at approval and execution; changed source/artifact/target/baseline requires a new approval. Preserve current accepted membership, pairing/capability, production human approval, branch policy, quota and emergency governance rules; this work does not weaken them.

The workflow independently verifies approved manifest/provenance through a trusted contract; accepting a caller's manifest and self-computed digest does not establish authorization. Define the trust/distribution mechanism before shipping the mutation lane. Signed approval envelopes require explicit issuer/audience, expiry, nonce, key rotation and replay verification; an allowlisted attested artifact contract may avoid a new signing service. This remains a design dependency, not an implemented verifier.

## Execution and truthful recovery

Before any ECS write, validate protocol/provenance/approval, effective workflow source, STS caller account, target task definition and all image digests, then compare actual service baseline to the approved baseline. Serialize per exact target. Never interpret missing describe-services/task-definition results as valid strings such as None/null.

A release must call `update-service --task-definition <approved-new-ARN>` and correlate the resulting ECS deployment identity. Wait boundedly, verify observed task definitions/image digests and separately evaluate the approved application health policy. Emit a terminal receipt containing the immutable manifest digest, exact workflow run/attempt/repository/source, target, baseline/new ARN+digests, ECS deployment identity, stabilization and actual health results.

On confirmed failed rollout, restore the approved immutable baseline, verify its stabilization and health, and record recovery separately. Successful recovery does not turn the original failed release into success. Cancellation, timeout and ambiguous write outcomes require explicit unknown/reconciliation state; never launch an automatic duplicate merely because a receipt is missing. Failed rollback becomes recovery_failed, not recovered. Neither health nor rollback proof may be fabricated from a step name or Actions conclusion.

## Staged implementation dependencies

1. Pure versioned restart/release manifest and provenance validators, canonical digest and fail-before-side-effect regressions. Correct exposed descriptions to distinguish restart from release.
2. Reviewed additive tenant artifact/execution receipt storage and read-only tenant GitHub build/attestation ingestion. Any production schema application requires separate approval; authentication-only repair approval does not cover this storage.
3. Approval preview snapshots and immutable reservation identity. Claim lifecycle eligibility before dashboard dispatch; retain uncertainty reservations and safe replay behavior. Define failed/expired claim reconciliation without prematurely marking deployment successful.
4. Separate v2 workflow/template, pre-write validation and actual immutable new-task-definition rollout/recovery. Retain installed restart compatibility. Pin third-party action identities according to repository policy.
5. One capability-aware dispatcher reused by Agent, desktop, Airflow and dashboard. Promotion requires exact artifact/source identity and verified previous environment health, not source SHA alone.
6. Read-only observer verifies exact run/attempt/workflow/repository/head SHA, manifest and target receipt before recording release or recovery. Expose pending, unknown and failed recovery honestly in customer UI.
7. Separately authorized sandbox acceptance: build attested image, approve target, deploy a new digest, observe real application health, induce a safe failure and verify baseline digest/health recovery. No live customer/production acceptance is claimed until this occurs.

## Behavioral regression harness

Extend the actual-template shell/fake-AWS harness and workflow parity tests. Assert **zero update-service calls** for unknown/missing protocol, malformed digest, mutable primary/sidecar image, untrusted attestation, moved source, wrong account/region/target, changed baseline, missing task definition, expired/replayed approval or missing capability.

Successful traces must use the approved new ARN, correlate deployment identity and emit matching manifest/source/target/digest evidence. Unhealthy traces must restore the exact approved baseline and verify recovery while preserving failed-release status. Rollback failure, cancellation, waiter timeout and ambiguous AWS response must remain distinguishable. Exercise two serialized operations whose baseline becomes stale, and exact operation-ID replays.

Composed tests must cover all four dispatch callers through the same contract, cross-tenant/environment artifact rejection, post-approval argument mutation, same-source/different-image promotion denial, lifecycle claim failure before dispatch, and wrong run/head SHA/attempt/manifest receipt refusal. Provider mocks prove control flow, not STS/OIDC/IAM permission or real deployment success.

## Approval and remaining external evidence

No production SQL, infrastructure, workflow dispatch, credentials, routing or live billing changes are authorized by this plan. Actual target ownership/OIDC trust, artifact registry access, health destination ownership and sandbox mutation/recovery acceptance remain access- and approval-dependent. Production database binding/PITR readiness and login recovery remain independent priority blockers; they must not be described as resolved by ECS regression tests.
