# Direct-workflow OCI proof prerequisite

Date: 2026-10-16. Scope approved by root after `/tmp/axiom-ecs-executor-next-report.md`. Base `24fb7ddec0db26f909279dbc1e0cfbf8be29aced`. This implements an internal build-evidence profile, not ECS review composition, executor authority or customer release availability.

## Outcome and limits

The installed official Sigstore verifier and existing bounded GitHub reader may accept one explicitly configured direct-caller workflow proof profile. The genuine pinned GitHub OCI fixture must pass without fabricated signatures or mocked verifier success. Its exact GHCR subject cannot be substituted with an ECR subject. DSSE proves signed names/digests and provenance; it does not classify image/chart media types, prove registry transfer, image pullability, application health, deployment or rollback.

Keep the existing `PublicTrustProfile` (`kind: "public_sigstore"`) and immutable reusable signer behavior strict. Add the distinct server-only `DirectWorkflowPublicTrustProfile` (`kind: "public_sigstore_direct_workflow_v1"`) and exported union `ReviewedPublicTrustProfile`; both use the same root/digest/review-window/signer fields. No inference, request-selected profile, default trust, route, catalog, ReviewFacts, executor, schema or provider capability is added. Only the verifier and GitHub evidence reader production modules change; contract/target/review/AWS/Airflow and legacy restart semantics remain unchanged.

## Profile and signed identity

The direct variant permits exactly the seven fields `kind`, `trustedRoot`, `trustedRootDigest`, `reviewedAt`, `reviewExpiresAt`, `signerWorkflow`, `signerWorkflowSha`. Its signer URI is exact HTTPS public GitHub repository/workflow identity ending in a conservative `refs/heads/<branch>` reference. The separately pinned signer SHA remains 40 lowercase hex. Tags and malformed/ref-ambiguous signer paths are unsupported.

When verifying direct evidence, require signer URI equal to the independently bound repository URL + workflow path + source ref. Require signer SHA = expected caller workflow SHA = expected source SHA. Keep all ten current identity OIDs, exact SAN/issuer, official signature/chain verification, CT/log/timestamp thresholds 1/1/1, complete subject set matching, exact repository ID/name, source ref/SHA, caller workflow path/SHA, run/attempt and signed invocation. The direct variant alone accepts `https://actions.github.io/buildtypes/workflow/v1` and additionally requires signed `runDetails.builder.id` equal to the direct signer URI. The reusable variant retains exactly `https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1` and its SHA-ending signer URI. Neither variant accepts caller-chosen build types or aliases.

Preserve current supported Node runtime floors, one-MiB bundle, bounded proof sets/root configuration, maximum seven-day root review window, root digest and before/after current tenant authority. Configuration and bindings are detached before awaits. Closed unavailable results disclose no raw provider/crypto errors.

## Reader treatment

Continue exact public-repository, successful completed run/current attempt, event push/workflow_dispatch, caller workflow SHA = source SHA and exact fetched workflow Git-blob validation. Preserve 30-second total read deadline, four-MiB aggregate budget, per-body limits, repository-specific reviewed bundle origin/path, no redirect/pagination fallback, and all repeated current context/config checks.

Reusable runs still require their matching immutable `referenced_workflows` member. Direct runs support absent or empty `referenced_workflows` only; malformed, null, nonempty or mixed reusable metadata is unavailable. Direct caller URI/ref/SHA must match the independently checked run. Remote metadata cannot nominate a trust profile or replace the signed identity. Output stays the existing build-evidence closed union with no approval/review/execution flags.

## Fixture provenance and permission

Public read-only GitHub fetches were explicitly authorized for license/immutable provenance only. The exact repository commit `github/artifact-attestations-workflows@cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b` contains `LICENSE.txt`, blob `0e259d42c996742e9e3cba14c677129b2c1b6311`, 7,048 bytes, SHA256 `a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499`: CC0-1.0. Its immutable `.github/workflows/ghcr-publish.yml` blob is `b3f2aedd9834c78d8dc005375ec389c9f35d819d`, 1,879 bytes, SHA256 `ab7e725dc352ce2a8f4d9bbe4d3f76cdee1709bf1f8514c20a9878a9a12df585`. The refetched bytes must equal the existing cache before vendoring. Retain the upstream license unchanged with fixture provenance notes; do not substitute the CLI license.

Cached genuine bundle SHA256 `49edde03a1879f18b95f03fb8b691137e6d3718fc21f64a22909b14fbb472c89` (10,973 bytes), OCI index `06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92` (1,607 bytes), bundle descriptor manifest `aa5e53aa720c58532973c396630d4cd0d9df9cde9ae13ab509f20770554abef5` (813 bytes). Signed subject is exactly `ghcr.io/github/artifact-attestations-workflows` with that index digest. Repository ID `804468129`, workflow `.github/workflows/ghcr-publish.yml`, source/signer/caller SHA above, ref `refs/heads/main`, run `10782915115`, attempt 1. No image or chart layers are included. Existing independently documented CLI test roots remain test material, not current production trust approval.

## Acceptance and evidence boundaries

1. Observe genuine verifier acceptance RED on missing direct profile; implement minimal new variant; retain reusable positive/negative tests.
2. Mutate expected repository/ref/path/source/caller/signer/run/attempt/subject/build type/builder and crypto/log/root/lifetime/authority. Recomputed envelope digests cannot repair corrupted signed content. Exact ECR-name substitution fails.
3. Observe direct reader RED on missing direct caller treatment, then GREEN using actual production reader and official crypto with explicitly synthetic current GitHub metadata and fixture token. Wrong current run/attempt/ref, mixed reusable references, context/config drift, foreign bundle policy, redirect, oversize, cancellation and missing trust remain unavailable. No real GitHub/AWS call is part of these tests.
4. Run focused lint and isolated affected-source types only. Root schedules full suite/whole application types/build and independent frozen-source security review. No compiler/server/Postgres without grant, dependency installation or deployment.
5. Preserve dependency qualification: installed read-only overlay uses `@sigstore/protobuf-specs` 0.5.2 while lockfile declares 0.5.0; clean CI remains authoritative. Evidence proves the exact tested source/runtime/dependencies only. Real ECR proof, reviewed executor/claim, provider/native/production acceptance remain open.
