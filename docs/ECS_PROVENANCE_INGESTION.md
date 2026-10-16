# ECS v2 provenance ingestion boundary

This source adds real **offline cryptographic build-provenance verification**, not an enabled release lane. No route, GitHub dispatch, AWS operation, database migration, review-packet ingestion adapter or execution claim is activated. The existing four-input ECS service-restart workflow is unchanged. `ECS_REVIEW_EXECUTION_ENABLED` remains false.

## Implemented boundary

`lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier.ts` uses the official pinned `@sigstore/verify` 4.1.2 API (`Verifier`, `toTrustMaterial`, `toSignedEntity`), `@sigstore/bundle` 5.0.0 and `@sigstore/protobuf-specs` 0.5.0. It verifies DSSE signatures, certificate chain and identity, certificate transparency and transparency-log/time evidence with explicit thresholds of one. It does not substitute API metadata or a JSON `verified` flag for cryptographic verification.

An internal caller must supply independently obtained tenant/repository/run expectations and an authority callback. Current tenant authority is checked before verification and again before returning evidence. Numeric repository ID, repository name, source ref/SHA, caller workflow path/commit, exact run/attempt and complete SHA256 subject coverage must match both the signed SLSA v1 statement and the modern Fulcio certificate extensions. A separately pinned reusable **signer** workflow URI/commit must match its certificate identity; it is not conflated with the caller workflow.

`manifestBuildBinding` reuses the existing parsed ECS manifest and maps the unique proposed immutable image references to exact subject names/digests. An attestation must cover this complete set; unrelated wheel/npm fixtures do not certify ECS image artifacts. Duplicate uses of the same immutable image across containers require one subject. Per-image bundles, alternative subject-name conventions and extra source dependencies currently fail closed; a future bounded adapter must implement an explicitly reviewed aggregation contract rather than weaken coverage.

Success returns **build provenance only**. It is not `ReviewFacts`, an approved packet, a verified task definition, an ECR image-presence check, application health, rollback proof, quota reservation or dispatch permission. Passing this helper never makes arbitrary input an independently verified review packet.

## Trust and runtime gates

- There are **no default runtime roots** and no automatic trust-network fetch. A server operator must independently review/configure the public Sigstore root material, its SHA256 over `JSON.stringify(root)`, exact signer workflow URI/commit and a bounded review validity window (maximum seven days). The pinned hash checks configuration consistency; it does not authenticate the configuration's origin. Only a trusted deployment configuration/adapter can establish that origin. No public route accepts these fields.
- Public profiles require certificate authorities, CT logs and transparency logs. Explicit proof thresholds cannot be disabled by input. Public visibility is bound in the certificate.
- Private GitHub Sigstore uses a different trust domain and timestamp model. `private_github` is explicitly unavailable until official private roots, timestamp policy, rotation and genuine signed fixtures are independently inspected. Replacing public roots or setting log thresholds to zero is not an implementation.
- The official package engine is `^22.22.2 || ^24.15.0 || >=26.0.0`. Unsupported Node versions fail closed **before dynamic package loading**. This does not authorize changing the production Node version. The local positive test used Node 24.19.0; actual serving runtime/configuration remains unverified.
- Inputs are bounded (1 MiB bundle, 256 KiB profile, 100 subjects); errors are sanitized. The helper performs no outbound network IO and does not consume credentials.

## Genuine fixture evidence and attribution

Fixtures are copied from the official GitHub CLI repository at immutable commit `3d7967df5a94052b0554898ffa02526f0f90b8c9`, not generated to assert Axiom success. The accompanying MIT license is preserved at `lib/releaseops/ecsReleaseV2/__tests__/fixtures/CLI-LICENSE.txt`.

| Upstream file in `pkg/cmd/attestation/test/data/` | Git blob | Local SHA256 |
| --- | --- | --- |
| `reusable-workflow-attestation.sigstore.json` | `4150fad017018a4901863e45a9fd61a6a7a3c12e` | `88e35c3496fc9b9bd29629b69271bd32738e170f0d85a12d67da0c72c743f3bd` |
| `trusted_root.json` | `eddf07bbb4b243a2b3e8633371e4760b520a0c54` | `455b3fe53e2678889f093d66ebbfda5f12ebb9d682b146c3535fa04e97689787` |

The signed fixture belongs to **malancas/attest-demo**, numeric repository `804070735`, run `9228858953`, attempt 1, source `95baf27389e83e6a5c48f42e190d48d7abcea19e`. Its caller is `.github/workflows/shared.yml`; its signer is the separately pinned `github/artifact-attestations-workflows` reusable `attest.yml` commit `09b495c3f12c7881b3cc17209a327792065c1a1d`. It attests a Python wheel, **not an Axiom container**. The fixture root is test-only and is never imported by runtime code.

Tests exercise real successful verification and rejection for signed payload mutation, missing transparency evidence, wrong numeric repository/name, source/ref, caller workflow/commit, run/attempt, subject/digest coverage, attestation-byte digest, signer, trust hash/expiry, unsupported runtimes and revoked tenant authority. These are offline software regressions, not production/project provenance or customer deployment acceptance.

## Remaining independent boundaries

1. A current accepted-membership and selected-policy adapter must obtain a tenant-scoped GitHub installation token, exact repository numeric identity and run/attempt metadata before bounded attestation download; recheck installation/authority after remote IO. Existing generic GitHub fetch lacks the required byte/abort/redirect policy and is not silently reused as a safe attestation reader.
2. Reviewed public root distribution/rotation/revocation must be configured in the actual serving runtime. Private-domain trust remains unavailable.
3. Build provenance must be combined with independently read ECR image availability, exact AWS target/task-definition/image/baseline bindings and policy facts before implementing `VerifiedReviewBoundary`. This helper cannot supply those facts.
4. Durable execution authority, operation/quota claim, exact run-attempt OIDC trust distribution, mutation policy, receipts and correlated application-health/rollback proof remain separate gated milestones described in `ECS_IMMUTABLE_RELEASE_PLAN.md`.

No production acceptance, data changes, provider actions or infrastructure authorization is implied by this source change.
