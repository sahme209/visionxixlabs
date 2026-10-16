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


## Next trusted ingestion and executor integration boundary

Design only. No workflow, provider, credential, routing, migration or deployment action is performed by this plan. The four-input installed legacy workflow remains unchanged and remains a requested service restart with unknown artifact/health/image-recovery proof.

## Next executable source boundary: real read-only ingestion

The durable review core's verifier is intentionally unavailable by default. The next milestone must supply independently verified facts, not another candidate parser or a callback that relabels submitted JSON.

| Proposed source | Concrete responsibility | Fail-closed dependencies |
| --- | --- | --- |
| `lib/releaseops/ecsReleaseV2/githubBuildEvidence.ts` | Tenant installation-scoped exact repository/run/attempt/source and workflow identity; bounded attestation-bundle acquisition | Current installation authority, repository access, exact build event/status/attempt, bounded responses and timeout; no latest-run guessing |
| `lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier.ts` | Pinned reviewed official GitHub/Sigstore verification and trusted roots, exact OCI subject digest/source/builder/workflow policy | No verification from metadata, OCI labels, caller digest or TypeScript type; absent supported verifier/trust roots returns unavailable |
| `lib/releaseops/ecsReleaseV2/awsTaskDefinitionEvidence.ts` | Full ECS service/task-definition/container/image and associated ALB target-group observations; ECR immutable image metadata as needed | Paired accepted tenant account, scoped vault, fresh broker-only exact STS identity, bounded read permissions and pre/post IO revocation/version checks |

Reuse existing enrollment authority/credential binding principles; do not feed cloud-v2 refs into the legacy Lead vault or reuse generic Agent credentials. The configured GitHub OIDC deployment role is not an ambient server/broker credential. Read-only inspection uses a separately authorized customer inspection role and reports denied/unavailable permissions honestly.

Every declared proposed/baseline container must equal the complete independently described task definition, including sidecars. A current mutable-tag definition cannot establish immutable baseline recovery merely because DescribeTasks exposes a currently running image digest. Creating a digest-pinned replacement baseline requires a separately approved task-definition registration write. Ingestion must return unavailable rather than register or invent that baseline.

The local `gh` executable inspected during planning has no `attestation` command. A tool upgrade/dependency must be pinned and reviewed; current CLI metadata access is not cryptographic verification. Exact package/CLI version, trusted roots and upstream fixture behavior must be evaluated before implementing the verifier.

## Build, registration and immutable identity

A customer's separately authorized build pipeline checks out the exact source commit, builds and pushes an OCI image, records its digest and produces verified provenance. The existing candidate contract requires already registered new and baseline task-definition ARNs. Registration is an explicit provider write and is not silently authorized by a review packet, source checkout or image build. Either consume an existing authorized pipeline's registered definition or review registration authority separately.

Clarify `workflowSha` as GitHub's workflow commit identity; it must not be confused with a file blob SHA. If file-content identity is needed, independently record/verify that blob identity without overloading the existing field. Build workflow and release executor identities remain distinct.

## Separate executor and server authority

A new `axiom-release-aws-ecs-v2.yml` capability should accept server operation/manifest identity and invoke an immutable pinned reusable executor. Do not add required inputs to or automatically fall back to the installed four-input legacy workflow.

The executor obtains GitHub OIDC for an explicit server audience and requests a claim. A future server endpoint must verify JWT signature/issuer/JWKS/algorithm/audience/expiry and exact repository numeric identity, run ID/attempt, event, source, workflow path/commit, reusable job identity and environment. Independently read GitHub run metadata; token or caller claims alone are not a current durable approval decision.

The claim reloads durable packet/decisions, current membership/quorum/policy, exact provider target/baseline and expiration. Actual execution needs a shared approval-revocation/claim fencing mechanism, not a Serializable review snapshot alone. Only then may it atomically claim the existing deployment allowance and execution identity. Until these boundaries are reviewed and implemented, the endpoint must remain unavailable. The review core does not consume live quota or mint claims.

A short-lived signed response binds manifest, operation, exact run/attempt/executor, target, new immutable task definition, approved baseline and nonce. Signing authority, issuer/audience, JWKS rotation, replay/expiry and unknown-outcome reconciliation require explicit design and tests. A reusable bearer approval is insufficient.

## Cloud trust cannot be assumed

AWS IAM must not be assumed to enforce arbitrary GitHub custom JWT claims directly. A repository/ref-only OIDC role permits another workflow to bypass the server claim path. A separately approved v2 trust configuration must bind the intended immutable reusable job, for example through a verified customized GitHub `sub` containing pinned `job_workflow_ref` and the required repository/environment identity, with strict `aud`; otherwise use a reviewed server credential-broker design. Actual subject format/encoding and AWS trust behavior require independent validation, not invented IAM condition keys.

Existing production roles/trust and workflows must not be changed by this source milestone. Missing private trust evidence keeps v2 execution unavailable. GitHub environment/repository controls remain additional gates; do not describe them as a cryptographic server-approval binding without evidence.

## Execution and receipt acceptance

After authenticating the server authorization, the executor independently validates STS account, target, exact new task definition and baseline, then explicitly updates the service to the approved new ARN. Bounded stabilization must be followed by task/image observation and ALB target membership/health correlated to the new ECS deployment. Healthy old targets do not prove the new release healthy.

Upload a structured terminal receipt bound to exact run/attempt/manifest/target. Server-side independent observations must agree before release acceptance. Failed rollout restores the approved immutable baseline, verifies its image digests and health, and leaves the original release failed. Lost responses, cancellation, timeout, missing receipts and ambiguous provider writes retain unknown execution claims; no blind retry or premature quota release.

## Locally executable acceptance before provider writes

1. Real offline cryptographic verification using pinned upstream signed bundle/trust fixtures: malformed signature/log proof, wrong digest/source/workflow/issuer and metadata-only JSON must fail. These fixtures are not real customer/provider acceptance.
2. Recording GitHub/ECS/ECR transports: tenant/install scope, bounded pagination/responses, exact run attempt, source/workflow drift, missing sidecar, mutable baseline, denied permissions and revocation during IO.
3. Locally signed JWT/JWKS fixtures: signature and algorithm policy, wrong audience/issuer, expiry, exact reusable workflow/run identity and replay. Local fixture signing does not prove actual GitHub identity.
4. Execute actual new template shell against fake `aws`, `gh` and HTTP executables, retaining template parity tests. Assert zero writes while claim authority is unavailable or identity/baseline changes; exact approved new ARN on rollout; health correlated to deployment; immutable baseline recovery; truthful recovery failure/unknown outcomes.
5. Two independent PostgreSQL clients race approval revocation against the actual execution claim/fence before connecting a dispatcher or live quota. Review checkpoint concurrency evidence alone is insufficient.
6. Separately authorized customer sandbox acceptance: real OIDC/read permissions, verified source-bound image and registered task definitions, reviewed rollout, observed health, induced safe failure and verified recovery. No production acceptance follows from local fixtures alone.

The next implementation target is trusted read-only ingestion. Workflow publication/dispatch, registry push, task-definition registration, IAM changes and actual rollout/recovery remain separate approval-dependent milestones.

### First ingestion implementation proposal and dependency review boundary

No dependencies are added by this document. The proposed exact low-level verifier pin is `@sigstore/verify@4.1.2`, with explicit `@sigstore/bundle@5.0.0` if importing its JSON decoder. Their complete resolved transitive graph and integrity/provenance must enter a reviewed lockfile change; no floating runtime trust dependency or install-time execution is proposed. The [official tagged package manifest](https://raw.githubusercontent.com/sigstore/sigstore-js/%40sigstore%2Fverify%404.1.2/packages/verify/package.json) requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`. Existing web CI uses Node24, but desktop/manual auth/migration workflows still include Node20. Confirm the actual serving backend runtime and every importing build/test path before approving this dependency; do not silently upgrade production runtime or choose an older crypto library just to bypass its engine requirement.

Use the official package's `bundleFromJSON` → `toSignedEntity` → `Verifier(toTrustMaterial(...)).verify(entity, explicitIdentityPolicy)` path. The [tagged exports and upstream tests](https://raw.githubusercontent.com/sigstore/sigstore-js/%40sigstore%2Fverify%404.1.2/packages/verify/src/__tests__/verifier.test.ts) provide the API and valid signed DSSE/Rekor-v2 fixtures. Test inputs/trust material are in that tag's `packages/verify/src/__tests__/__fixtures__/bundles.ts` and `trust.ts`. Resolve the tag to a reviewed immutable commit, preserve Apache-2.0 attribution and record imported file hashes before fixture adoption. Upstream test roots contain test/staging material and must never become production trusted roots. Actual production trust acquisition/rotation/revocation policy is a separate reviewed input, not accepted from a candidate or arbitrary URL.

[GitHub's offline verification guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline) distinguishes public Sigstore and GitHub-private trust roots and numeric repository identity. A matching owner/name is insufficient after renames/name reuse. The [official attestation security description](https://docs.github.com/en/actions/concepts/security/artifact-attestations) notes that GitHub's private instance has no transparency log. Therefore implement explicit reviewed trust profiles; do not globally lower verification thresholds to accommodate missing proofs. Public-profile verification requires its expected certificate/log/timestamp evidence; private-profile verification needs official private-instance root/timestamp fixtures and policy before enabling it. Until then, private-profile input returns unsupported/unavailable, never verified from API metadata alone.

The initial source change should compose real read-only GitHub evidence and cryptographic verification, then actual bounded AWS task-definition observations, into the review core's internal boundary. Reuse `resolveTenantScopedToken` and `githubAppAuth` for tenant/repository-scoped tokens, but add exact run-attempt and attestation reads with explicit response-byte, pagination, timeout and redirect policy. The existing private `gh()` fetch helper in `githubWriteClient.ts` has no timeout/response-byte bounds; do not assume it already supplies a secure attestation downloader or copy its write API surface into this reader.

For AWS, reuse `readTenantAwsInventory`'s pre/post paired-session, accepted membership, scoped AEAD credential, account/ref/region/version/revocation fences. `assumeVerifiedRole` in enrollment `stsValidation.ts` is currently private and broker-only; refactor a bounded scoped read primitive carefully rather than export raw temporary credentials or enable generic workloads. The existing ECS SDK dependency can describe services/task definitions/tasks. ECR SDK is not currently a direct dependency; add it only after a separate exact-version review if registry existence inspection is required. Neither task-definition image references nor attestation subjects alone prove a registry object remains pullable.

Meaningful initial acceptance is real offline signature verification plus recording read-only transports and current authority/revocation regressions; missing fixtures/runtime/trust/read access remain explicit unavailable outcomes. No helper may construct `independently_verified` merely because JSON fields compare. Cloud writes, approval claim distribution and workflow execution remain disabled while these inputs are incomplete.
