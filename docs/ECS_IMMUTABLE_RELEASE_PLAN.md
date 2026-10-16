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

## Proposed prerequisite: AWS task-definition observation contract v1

This section is a review proposal, not an enabled reader or a new protocol implementation. It must be independently reviewed before code. Existing four-input restart behavior is unchanged. No provider call, installation, package mutation or production change accompanied this proposal.

### Canonical registration projection

Proposed identifier: `axiom.ecs.taskdef.registration.v1`, based on the currently locked ECS SDK `3.1049.0` model. Define `contentDigest = sha256:<hex>` over UTF-8 canonical JSON `{schema:"axiom.ecs.taskdef.registration.v1", registration:<projection>}`. Object keys sort lexicographically recursively; arrays preserve order; strings remain exact (no trimming, case folding or Unicode normalization); absent optional properties are omitted, while null, false, zero and empty collections remain distinct. Reject non-finite numbers, unsupported values, cycles, oversized documents and unknown modeled fields rather than silently dropping them. Container names and each named key collection must be unique; missing names/images fail closed. Do not sort command, entryPoint, health-check commands, environment files or any other potentially ordered sequence. Reordering an array may conservatively change the digest.

The top-level projection is the complete registration input represented by DescribeTaskDefinition: family, taskRoleArn, executionRoleArn, networkMode, containerDefinitions, volumes, placementConstraints, requiresCompatibilities, cpu, memory, pidMode, ipcMode, proxyConfiguration, inferenceAccelerators, ephemeralStorage, runtimePlatform and enableFaultInjection. Every nested modeled property is retained and schema-validated, including container repositoryCredentials, restartPolicy, portMappings, essential, entryPoint/command, environment/environmentFiles, mounts/volumesFrom, linuxParameters and capabilities/devices, secrets and log secretOptions, dependencies/timeouts/versionConsistency, user/hostname/workingDirectory, networking/DNS/extraHosts, privileged/read-only filesystem, security options, terminals, labels, limits, logging/firelens, health checks, system controls, resources and credentialSpecs. Volume configurations include full EFS authorization/transit encryption, Docker, host and configured-at-launch declarations, plus the actual locked model's s3filesVolumeConfiguration and fsxWindowsFileServerVolumeConfiguration (including all nested authorization/domain/credential parameter and root-directory properties). Omitting either S3 Files or FSx Windows configuration would leave this projection incomplete and must fail schema review. Nested runtime/platform and proxy values are included without permissive defaults. A checked-in explicit versioned schema, reviewed against all reachable SDK nested types, is required; merely hashing a selected handful of fields or an unchecked JSON bag is insufficient.

Exclude service-generated identity/lifecycle metadata only: taskDefinitionArn and revision (bound separately), status, compatibilities, requiresAttributes, registeredAt, registeredBy, deregisteredAt and deleteRequestedAt. Tags are not represented in this registration digest: include:TAGS may independently capture a tag-set digest if governance later relies on them. Therefore v1 does not claim tag-policy authority. Unknown future AWS fields can be discarded by an older SDK deserializer before application validation; pinned-model coverage is a stated limit, not forward-compatible security completeness. Updating the SDK requires schema/digest-version review and an explicit compatibility decision.

The existing TaskDefinitionPin has no canonicalization-version field. Do not silently mix historical arbitrary contentDigest values with v1. A future adapter must expose its digest schema explicitly, reject unsupported candidate conventions, and receive a reviewed contract compatibility change before constructing full ReviewFacts. No executable workflow currently produces an agreed v1 digest.

### Secret handling and exact output boundary

A server-only observation may return only: kind=`aws_ecs_observation`; organizationId/environmentId; connection `{id,version}`; target snapshot `{id,updatedAt}`; verified accountId/partition/region/roleArn; exact clusterArn/serviceArn; baseline and proposed `{arn,digestSchema,contentDigest,images:[{container,image}]}`; associatedTargetGroupArns; observedAt; and explicit limits `{providerReadOnly:true,serviceSnapshotOnly:true,healthVerified:false,rollbackVerified:false,executionAuthorized:false}`. Every image must be an exact same-account/region ECR digest URI; complete container sets, including sidecars, are mandatory. No environment values/names, commands, labels, logging options, secret references/values, credentials, external ID, session tokens, raw SDK output, presigned URLs, task network addresses or registry authorization tokens enter output, errors, audit summaries or logs. Never call Secrets Manager/SSM GetParameter or ECR GetAuthorizationToken.

The registration input exists transiently in trusted process memory to hash it and is not persisted by this reader. A plain SHA-256 commitment can still support guesses of low-entropy inline environment secrets if an observer knows the remaining input. Accordingly this DTO and its contentDigest must remain internal to the current authorized review boundary, never a public/browser telemetry artifact; the digest is not encryption or a secrecy guarantee. If the product needs public commitments while permitting inline secrets, separately review a keyed/redacted commitment protocol or reject unsupported secret-bearing inputs; do not improvise redaction that loses security-relevant configuration binding. AWS secret references are not secret values, but are still withheld from this summary.

### Unresolved target authority and bounded implementation boundary

DeploymentTarget currently stores id, organizationId, environmentId, provider, roleArn, region, ecsCluster, ecsService and updatedAt; it has no integer revision corresponding to manifest.target.revision. Observe and compare exact id+updatedAt and full scoped target values before/after I/O. Do not manufacture a revision from timestamps, accept a candidate's revision as authoritative, or claim full ReviewFacts matching until this discrepancy receives a reviewed solution. Enrolled read-role trust and GitHub deployment OIDC role trust are also different authorities. The narrow initial profile may require exact matching role/account, but must never infer that read permission proves deployment permission or OIDC trust.

Reuse the scoped enrollment vault/authority fences and broker-only verified STS implementation through a callback-scoped primitive. The callback receives only narrow bounded describe functions returning validated/sanitized observations, never an unrestricted SDK client, client.config, raw provider response or temporary credentials. An SDK client can expose its credential provider through config and is therefore not a safe callback boundary. Do not reuse the legacy ambient ECS extractor/credential resolver. Proposed cap: one selected service, two exact task-definition revisions, ten image pins total, four same-account/region repositories, no pagination/list discovery, 45-second overall deadline, six-second per-resource call, maxAttempts=1. Two DescribeServices reads bracket two DescribeTaskDefinition and at most four digest-addressed ECR DescribeImages calls, plus exact AssumeRole/GetCallerIdentity. The new reader profile explicitly uses one attempt, six seconds per request and the shared parent deadline for STS as well as ECS/ECR. Existing enrollment STS callers retain their current two-attempt/eight-second behavior; do not change their defaults while factoring the primitive. Require one stable primary deployment referencing the observed baseline; mixed deployments, mutable tags, ambiguous/missing/foreign identities or changed authority/connection/target withhold observations. Associated load balancers prove association only, not health, image recovery, task stabilization, provenance or approval.

### ECR dependency inspection and minimal proposal

The lockfile resolves existing ECS to `@aws-sdk/client-ecs@3.1049.0`, Node >=20, using the shared AWS/Smithy graph. ECR is absent from package.json, package-lock.json, installed worktree dependencies and inspected npm cache (`npm cache ls` found no client-ecr entry). Therefore no exact cached ECR artifact, integrity or compatible dependency manifest was available to verify offline. Do not invent an integrity hash or claim a zero-transitive package delta.

Subsequent explicitly authorized read-only official registry inspection confirmed `@aws-sdk/client-ecr@3.1049.0` exists. The 138,004-byte tarball downloaded only to `/tmp` matches registry SHA-512 integrity `sha512-DkLyg4kXthvZOLT84gdXVBwQQ4qc749TG05r1boTMmlgF/ns+7JjgFpJ1CNXIgxP4Q/72N//H3vIUhTVNBi8NA==`. Its manifest requires Node >=20, Apache-2.0, CJS `./dist-cjs/index.js`, ESM `./dist-es/index.js` and TypeScript `./dist-types/index.d.ts`, has no exports map or install lifecycle hooks, and declares sideEffects:false. Its actual tarball contains DescribeImagesCommand input/output types. This is package inspection, not installation or runtime/provider acceptance.

All ten declared dependencies exactly equal those of the currently locked ECS package and satisfy existing root resolutions: sha256-browser/js 5.2.0; AWS core 3.974.13, credential-provider-node 3.972.43 and types 3.973.9; Smithy core 3.35.0, fetch-http-handler 5.4.3, node-http-handler 4.7.3 and types 4.19.0; tslib 2.8.1. Therefore the proposed minimal delta is package.json's one exact direct dependency, package-lock's root dependency entry and one new node_modules/@aws-sdk/client-ecr package entry with the verified resolved URL/integrity/manifest. There are no newly missing declared transitive packages relative to this exact lock graph; no existing versions need change. This conclusion is not a performed lock regeneration or npm-ci proof. An independently reviewed isolated lock/install gate must still check the eventual delta before integration. Preserve the current graph, do not install or regenerate the lock as part of this plan, and do not substitute custom SigV4/fetch or a floating package.

### Review and regression acceptance before implementation

Independent review must approve the complete nested canonical schema, secret/commitment restrictions, explicit unavailable target-version contract, SDK dependency graph and callback credential lifetime. Tests must change each security-relevant task/container/volume field and show the digest changes, preserve ordered arrays, reject duplicate names/unknown fields/malformed digests and cover every included model property. Composed service fixtures must prove exact tenant/session/role/connection/target fences before/after each provider read, no ambient credentials, exact service/task-definition/container/ECR identities and zero writes. Deferred calls must test revocation, expiry, replacement and changed deployment snapshots. Deadline, byte/shape caps, denied reads and missing/mutable images must fail closed. Genuine AWS acceptance requires a separately authorized account/role/resource read; synthetic SDK wire fixtures prove local application/transport behavior only. No ReviewFacts construction, public route, schema migration, provider mutation or execution activation is included in this prerequisite slice.

### Proposed pre-deserialization wire budget mechanism

The existing locked `@smithy/node-http-handler` exposes NodeHttpHandler.handle returning an HttpResponse whose body is the native stream. Reuse that handler inside a narrow response-budget wrapper configured on the new reader's STS/ECS/ECR clients. Immediately after native headers arrive, before returning the response to Smithy deserialization, validate Content-Length against a 512 KiB per-response cap and a shared 2 MiB operation budget. Reject malformed/duplicate length semantics and unsupported Content-Encoding (initial profile accepts absent/identity only). Never infer safety from Content-Length alone.

For an IncomingMessage/Node readable, replace the body with a backpressure-aware bounded stream that accounts every raw byte before forwarding a chunk to any SDK collector/parser; an over-cap chunk is never forwarded. Bound both per-response and shared budgets, including provider error bodies and all STS responses. Reject unsupported body types instead of forwarding an unbounded stream; if the handler returns an already materialized Uint8Array, validate its length before returning it, while documenting that native Node handler is required to avoid prior unbounded materialization. The operation deadline and per-call abort remain active through end-of-body, not just receipt of headers. On timeout/overflow/parse failure, destroy the original response and bounded stream, abort the request, detach listeners and destroy owned clients in finally; do not log the STS body. No extra accumulating copy may be made by this wrapper. A custom streamCollector may additionally enforce the same budget, but a post-deserialization JSON size check or collector-only override without inspecting actual SDK protocol paths is not an adequate pre-buffer guarantee.

This mechanism is not yet implemented or acceptance-tested. Before coding, inspect the actual locked ECS/ECR/STS deserializer/collector paths and ensure no alternate native handler or early buffering bypasses the wrapper. Local streaming fixtures must deliver chunked bodies exceeding the cap without Content-Length, dishonest lengths, slow/incomplete streams, rejected compression, oversized error XML/JSON and cumulative small replies; assert original sockets close and no excess chunk reaches the parser. A real Node HTTP → actual SDK response-parser harness must verify the bound, rather than a mocked send returning an already buffered object. Shared-operation exhaustion must prevent later requests. No dependency patch or broad network-sandbox claim follows from this design.

### Installed Smithy attachpoint inspection and coherent implementation slice

Read-only inspection of the pinned installed graph confirms the response attachment point: `@smithy/node-http-handler/dist-cjs/index.js` handle at line 264 creates HttpResponse with body=res (native IncomingMessage) at lines 345–352. Its resolve helper clears handler timeouts at headers (lines 287–291); built-in requestTimeout alone therefore does not bound the full response body. Its abort handler at lines 362–375 destroys the request until request close, but the proposed wrapper must independently keep its combined parent/per-call abort and source-stream cleanup alive through body end. The same file's Collector at lines 836–860 buffers every chunk then Buffer.concat, making interception before SDK collection mandatory.

`@smithy/core/dist-cjs/submodules/protocols/index.js` collectBody at lines 12–20 delegates stream bodies to context.streamCollector. ECS and the inspected ECR tarball select AwsJson1_1Protocol in runtimeConfig.shared.js: Smithy RPC deserialization collects errors at lines 578–582 and success at lines 601–605. STS selects AwsQueryProtocol; `@aws-sdk/core/dist-cjs/submodules/protocols/index.js` lines 1343–1364 collect both error and success response bodies. Thus one response-handler stream fence can cover every scoped command without custom request signing or a copied AWS protocol client. Exact line numbers are inspection evidence for this lock, not a stable upstream API contract.

Concrete next slice (single cohesive review/PR, only after design review):

1. Add a versioned explicit task-definition registration schema/projector module, covering all nested current ECS registration shapes including S3 Files/FSx Windows. Its strict bounds and digest version are observation-only; it cannot create legacy TaskDefinitionPin authority. Add a model-coverage checklist that forces review when the SDK graph changes.
2. Extract the current paired-authority/scoped-vault/pre-post connection fence from enrollment inventory into one reused internal scoped-connection module, keeping the existing inventory response and authorization behavior unchanged. The new ECS observation additionally requires accepted owner/admin and tenant environment/DeploymentTarget snapshots. No credential callback accepts caller-issued raw credentials, no legacy credential resolver and no global AWS provider chain.
3. Refactor broker-only STS internals into a callback boundary returning only a small object of allowlisted describe functions whose outputs are sanitized within the boundary. Configure all new reader STS/ECS/ECR clients with explicit credentials, explicit region, maxAttempts:1 and bounded handler; retain existing enrollment defaults (two attempts/eight seconds). Clients, config/credential providers and raw temporary credentials never escape. Disable configured endpoint URL overrides for this narrow runtime profile; isolated wire tests may supply an explicitly injected owned transport seam, never an environment-driven production override.
4. Implement one shared operation response budget/handler wrapper around actual NodeHttpHandler. Validate native response headers/rawHeaders, reject 3xx rather than delegate redirect behavior, reject unsupported compression/body types, and replace the readable with a bounded backpressure-aware stream before SDK deserialization. Count before forwarding, include error/STS bodies, share 2 MiB across the operation, limit each response to 512 KiB, and destroy originals on violation/abort. SDK maxAttempts:1 plus transport counter assertions must establish no hidden retry; normal provider 4xx/5xx bodies may be parsed only within this budget. The wrapper has no public route and exposes no signing or connection API.
5. Add one internal tenant ECS observation reader performing only the bounded exact DescribeServices/DescribeTaskDefinition/ECR DescribeImages sequence described above. Service and target/connection/membership snapshots bracket the reads. It returns only the explicit internal observation DTO; target remains id+updatedAt and candidate revision is never certified. No ReviewFacts adapter, active flag, storage write, approval, health or executor connection is added.
6. Verify one real Node HTTP→actual STS/ECS/ECR SDK parser fixture with synthetic protocol replies and source-owned loopback transport. Exercise success and provider-error paths; chunked/false-length/overflow/compression/stalled streams, aggregate exhaustion and cancellation must stop before unbounded collection. Composed reader tests cover tenant/session/version/role/target changes, complete container sets, foreign/mutable/missing images, denied reads and no writes. Fixtures never become real AWS acceptance.

Expected ownership is approximately 14 files: four new runtime modules (registration schema/projector, scoped connection boundary, bounded Smithy response handler, ECS observation reader), two existing enrollment files refactored (inventory and STS), four dedicated behavioral/schema/wire/composed test files, package.json and package-lock for the separately reviewed exact ECR pin, this existing plan and the enrollment/service documentation. Existing runtime auth/routes, Prisma/schema, master execution protocol and dispatch workflows remain untouched. Exact file count may change only to preserve the actual existing kernel instead of duplicating it. No standalone helper PR is proposed. Full compilation waits for the coordinated independent-review/active-harness window; no heavy checks or implementation were performed for this plan.


## Proposed target-snapshot compatibility milestone (read-only audit, not implemented)

Inspected the inactive contract/review core and the proposed tenant AWS reader.
No provider calls, tests, schema execution or implementation occurred for this
proposal. This closes neither execution authorization nor customer acceptance.

### Exact incompatibility and recommended boundary

`ecsReleaseV2/contract.ts` requires protocol `axiom.ecs.release.v2` and an exact
seven-field target including positive integer `revision`. Trusted review facts,
release evidence and receipts compare that complete target. `DeploymentTarget`
(`schema.prisma`) has id, scoped configuration and `updatedAt`, but no revision;
`deploymentTargetResponder.ts` upserts configuration without a revision counter.
`ecsObservation/reader.ts` honestly returns `{id,updatedAt}` after full pre/post
row comparison. A timestamp, credential version, voter decision revision or ECS
task-definition ARN revision must never be relabeled as that missing target token.

Recommended source-only decision: add an explicit new manifest protocol variant
(for example `axiom.ecs.release.v3`) to the SAME parser/comparison/review kernel.
Its target retains the exact AWS coordinates, but replaces integer revision with
an explicitly typed target snapshot: persisted target id plus versioned canonical
snapshot digest. Require strict, disjoint field sets; reject mixed variants.
Do not silently change v2 semantics or automatically upgrade old packets.

One shared server projector should hash a labeled schema and all scoped target
fields: id, organizationId, environmentId, provider, roleArn, region, ecsCluster,
ecsService and explicit ISO updatedAt. Bind the selected connection id/credential
version in the new snapshot contract/context as well, so replacement/revocation
cannot be hidden behind matching ARNs. No encrypted configuration, external ID
or secret enters the projection. Reuse `evidenceDigest`; a digest is equality
identity, never provenance, management authority or permission to execute.
Snapshot equality cannot promise detection of every historical ABA write or
exclude a change after commit; it is not a fabricated monotonic generation.

### One coherent producer/consumer change, with ownership seams

| Seam / owner boundary | Required reviewed change |
| --- | --- |
| Contract owner: `ecsReleaseV2/contract.ts` | Discriminated manifest/target variant, strict parser, full manifest digest, trusted review/release comparison and receipt target matching all understand the same version. Existing v2 bytes/digests retain their meaning. Promotion still binds artifact/source and separately proven prior health. |
| AWS evidence owner: `ecsObservation/reader.ts` and scoped connection | Produce the canonical snapshot digest from independently loaded rows, bracket provider IO, and return exact row/connection identity. Never copy a candidate token into trusted facts. Explicitly require supported task digest schema before mapping the reader's `{arn,digestSchema,contentDigest,images}` into existing task pins; its content digest already commits the registration schema. |
| Build evidence owner: `githubBuildEvidence.ts`, `sigstoreBuildVerifier.ts` | Use the shared version-aware candidate type/parser; preserve complete attested image subjects, repository/run/attempt/workflow identity and post-IO context checks. Neither component can certify AWS state or management readiness. No second release kernel. |
| Independent review-boundary owner | Compose independently verified GitHub and AWS observations, exact environment/policy and supported target snapshot into ReviewFacts; never manufacture facts by copying the submitted manifest. This composition is currently absent. |
| Transaction/store owner: `reviewCore.ts`, `postgresReviewStore.ts` | Add a narrow current snapshot reader on the existing ReviewTransaction. After provider IO and before create/replay, re-read scoped environment/target and connection generation in the SAME final Serializable packet transaction; compare with the captured digest and current policy/membership. Current prepare only rechecks membership/policy, so a standalone reader adapter is insufficient. Preserve unique tenant/operation replay and different-content conflict. |
| Approval owner: packet/decision/checkpoint lifecycle | Store new variant in existing JSON fields; keep revision CAS and current-member quorum/revocation checks. New protocol/snapshot means a new digest and fresh review, never reinterpret existing approvals. Checkpoint remains review-only stored evidence, not fresh provider readiness or an execution permit. |
| Future execution/receipt owner | At an actual claim boundary re-read target/connection/provider baseline, current policy and durable approval/revocation under a shared claim fence before quota/dispatch. Bind the new version/digest into exact run/attempt authorization and independent rollout/recovery receipt validation. No such executor/claim/authorization boundary is implemented by this compatibility slice. |
| Fixtures/docs/customer callers | Update strict contract/receipt fixtures, review harness and owned PG tests for both variants. Any future UI/API must show the server-resolved target identity and require fresh review after mismatch; currently no public v2 review/execution route is activated. |

Existing review SQL stores manifest/evidence JSON objects and digest references,
not a SQL target-revision column/protocol enum. This source compatibility choice
therefore needs no new production schema migration. Existing proposed review
storage still requires its own production approval/readiness; do not assume those
tables exist merely because the owned PostgreSQL rehearsal supports them.

### Alternative: future persisted monotonic revision

A separately approved DeploymentTarget revision column could provide explicit
optimistic generation semantics, but requires migration/backfill/default decisions,
all create/update/upsert/import/direct-SQL writers to increment conditionally,
concurrency/overflow/recreation rules and old-client compatibility. Adding it to
normal Prisma model reads risks P2022 against unmigrated production. It cannot
be inferred/backfilled as historical truth from timestamps. Even a real counter
would not replace row id, tenant scope, provider/connection freshness or final
claim fencing. Prefer the source-only explicit snapshot variant now; consider a
real revision only as a future approved migration, not a temporary integer shim.

### Acceptance and activation gates remain separate

The GitHub reader snapshots branch rules and verifies build provenance; it does
NOT establish CODEOWNERS approval, linked PR review, change-ticket validity,
release-tag readiness or verified promotion. Resolve these from their actual
trusted producers and bind policy/current context; unsupported required evidence
must keep review/readiness unavailable. AWS describe/ECR observations establish
neither registry pullability, running-image convergence, ALB application health,
rollback success nor GitHub deployment OIDC permission. The inspection role and
deployment role/trust remain different authorities.

Before merging a source-only compatibility implementation: independent review;
old-v2/new-variant parsing/hash/receipt tests; missing/mixed/forged-token rejection;
row recreation and target/connection drift during IO and before packet commit;
existing packet replay/conflict/quorum/revocation tests; actual owned-PG final-tx
fence checks; full regression and exact-head CI. No activation follows from green
fixtures. Directly installed legacy `axiom-deploy-aws-ecs.yml` and exported
four-input template remain unchanged; never fall back to restart as a v3 release.

Before any operational release: separately approve runtime/storage activation,
required readiness evidence, immutable pinned executor distribution, exact GitHub
run/attempt claim plus signing/broker and replay design, revocation/claim fence,
private OIDC/IAM trust and bounded nonproduction execution. Prove actual source
artifact rollout, health and baseline recovery with independent receipts. Production
DB/infrastructure/workflow publication, live quota consumption and dispatch remain
outside this proposal and require their existing explicit approval gates.
