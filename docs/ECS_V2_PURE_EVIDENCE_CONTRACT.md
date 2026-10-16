# ECS v2 pure evidence contract

This implements only the first slice of `ECS_IMMUTABLE_RELEASE_PLAN.md`: pure candidate validation and comparisons against independently obtained evidence. It changes no workflow, route, schema, storage, credential, deployment or infrastructure. It does not enable ECS v2.

## Candidate identity is not authority

`lib/releaseops/ecsReleaseV2/contract.ts` accepts a closed, versioned manifest and returns `structural_candidate`, its canonical content digest, image-set digest and health-policy digest. Caller-provided hashes, attestation references, source labels or approval identifiers are not verified by parsing. No result is named or treated as dispatch authorization.

The initial candidate shape contemplates existing, separately registered proposed and baseline task definitions. Both must use the expected account/partition/region and pin every declared container image by digest. The two task-definition ARNs must differ; this shape cannot relabel a same-definition service restart as a release. Actual completeness of the container list and task-definition content must be established by independent AWS description evidence, not the candidate.

Build workflow provenance and release executor workflow identity are separate. A release run/attempt must be bound to an independently loaded operation claim; another successful run of the same workflow/source is not a matching receipt. Explicit promotion references bind the prior execution and environment; matching source alone is insufficient, and environment-specific task definitions may differ while the named container/image set remains identical.

Container lists are canonicalized by deterministic ordinal container name. Object ordering does not change the digest. Task content digests, source/build/executor identities, target revision, rollback baseline, health policy, promotion reference, operation, tenant/environment and expiry all participate in manifest identity. The candidate is detached from caller-owned objects; all decision-time matchers recheck its content identity.

## Trusted comparison inputs

`matchTrustedReleaseEvidence` requires a context owned by a future trusted application boundary. It compares current source/build/verified image subjects, executor revision, target revision, proposed/baseline task definitions, associated health target and current durable approval receipt against the candidate. Its `evidence_match` means only that those independently supplied facts agree. The function does not verify Sigstore/GitHub attestations, load memberships or quorum decisions, authenticate a workflow, reserve quota or claim a deployment.

`matchPromotion` requires a trusted prior execution receipt, exact requested environment/execution and repository ID/name, identical source/image set and successful release plus health. A failed release followed by successful recovery cannot qualify.

`matchExecutionReceipt` requires both a durable operation/run claim and independent GitHub/AWS observations. Run identity includes repository, source, executor workflow revision and attempt. Release success requires actual stabilization, the approved health policy and a successful matching Actions run; a step name or Actions success alone is insufficient. Recovery compares the approved immutable baseline and returns recovery success while keeping original release success false. Missing observations, uncertain outcomes or failed health stay `unproven`, including when the provider task/deployment identity is unknown. This comparator is not the eventual lifecycle reducer or reconciliation worker. Its initial recovery receipt represents recovery inside the failed rollout run; a separately approved later recovery job requires a separately designed claim/receipt contract and is not accepted as release success.

The future health boundary must associate healthy ALB members with the exact approved ECS rollout/tasks; an aggregate count of old healthy targets is insufficient. The historical receipt comparator parses the manifest at its creation time; durable dispatch evidence must separately prove that approval and claim were valid when execution began.

The trusted-context TypeScript interfaces are an internal integration seam, not proof by themselves. A network endpoint must never deserialize caller JSON into these contexts or manufacture them from the submitted manifest/receipt. Tests construct trusted fixtures solely to exercise comparisons; they are not cryptographic or provider acceptance evidence.

## Deliberately unresolved and disabled

- Durable manifest/approval storage, current membership/quorum/policy rechecks, quota/idempotency/target claims and read-only attestation ingestion still require the next reviewed slice.
- Workflow capability discovery, trusted OIDC claim endpoint or signing distribution, issuer/audience/nonce/replay/key policy and actual AWS trust enforcement remain undefined. No signing or verification service is introduced here.
- Registration/build/registry authority is outside this shape. No image build, push or task-definition registration occurs.
- The health candidate supports only a bounded, account/region-associated ALB target-health policy; it is not an implemented probe or complete application acceptance. Arbitrary HTTP URLs are rejected. The initial numeric bounds are structural safety limits, not an enabled operational/commercial policy.
- No ECS write lane, automatic restart fallback, promotion UI, SDK authority or legacy scanner bridge is added. Installed v1 remains unchanged and remains a service restart.
- Production schema execution and all actual cloud mutation/rollout/recovery acceptance require separate explicit approval. Authentication-only recovery approval does not cover ECS storage.

## Regression evidence and next integration

Pure tests cover mutable primary/sidecar/baseline images, malformed scope/expiry, unknown fields, changed source/provenance/executor/target/artifact/baseline/approval, cross-tenant promotion, same-source/different-image promotion, exact run/attempt/claim binding, unproven health/outcomes and successful recovery without false release success. No tests call AWS, GitHub, a database or a signing service.

Next: review additive storage and the trusted IO boundary, then connect all four callers to one reservation/approval service before introducing a separately versioned workflow. Existing provider behavior and real sandbox acceptance remain unverified by this slice.
