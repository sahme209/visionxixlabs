# Fixed Fixture Artifact Delivery Implementation Plan

> **For agentic workers:** Execute under the existing bounded local runtime source grant. Use the reviewed contract; no real artifact/engine/runtime/privileged operations.

**Goal:** Make the new fixture producer and its exact dependencies representable by a strictly bound source packaging profile.

**Architecture:** Preserve legacy v2 defaults and receipts. A new materialization/3 pre-manifest record binds fixed inputs; a separate post-manifest delivery receipt binds the final package digest without a hash cycle. A strict v3 container derives twelve app files plus one external tool Node; a fixed verifier prelude and parent native root checks precede shared Prisma imports.

**Tech Stack:** Existing Python validators/source adapters, webpack emitter, TypeScript tests and fully stubbed native C tests. No dependency installation.

**Spec:** docs/recovery/2026-11-05/governance-fixture-delivery/CONTRACT.md

## Global constraints

- No actual package/app/image assembly, engine invocation, native/helper/Security/Keychain/SQL/account/provider/signing/deployment operation; synthetic owned-filesystem fixtures and pure/mock tests only.
- Exact four app resources and external Node, exact fixed source/destination roles. No arbitrary extra-path array, ambient modules, NODE_PATH or payload-owner UID0 assumption.
- No source/materialization receipt embeds its own future full package digest. Final delivery receipt stays outside the manifested package and main receipt.
- Existing v2 default acceptance/rejection behavior and historical evidence stay intact; v3 requires explicit new tags and trusted constant parameters.
- Source/hash/mode/dependency verification is not runtime, custody, native transport or same-consumer qualification.

## Review focus

1. Any unchecked alternate helper dependency path must refuse rather than fall back.
2. Source/hash/generation/materialization/package mismatches must fail before copies.
3. Extra files/aliases/overlapping outputs must not enter the v3 allowlist.
4. Parent framework integrity checks must not introduce unsafe post-fork work.
5. Seal validation must preserve every authoritative leaf/resource and the external Node; only the separate main's signature fields and CodeResources may differ.

## Task 1 — source build/materialization profile

**Owner:** system_assembler.
**Files:** new scripts/governance_local_issuer/fixture_delivery_inputs.py; existing scripts/build-local-issuer-package-source.py; materialize.py; scripts/emit-synthetic-fixture-producer.cjs; focused new tests.
**Interfaces:** record_fixture_delivery_inputs(stage, packet); verify_fixture_delivery_inputs(stage, after_build=False); verify_fixture_materialization(receiptPath). Final fixed delivery record exposes mainMaterialization/sourceInputs bindings plus format/profile/generation/sourceRevision/packageDigest/dependencyRoot/resources/toolNode and false authority flags, as agreed in CONTRACT.

- [x] Write focused failing tests for exact fixed input profile, fixed external mapping/banner, independent recipe/schema/engine/seed/client joins and missing bindings.
- [x] Observe RED, then implement fixed source adapters and the separate pre/post-manifest DAG. No receipt rewriting/restamping or actual generator/engine call.
- [x] Check resource copies are fresh/quarantined and original runtime Node bytes retained; final receipt joins the actual full manifest and source record.
- [x] Run only relevant new tests plus directly affected compatibility tests; record exact commands/output and source inputs.

## Task 2 — strict v3 container/seal and safe pre-import

**Owner:** owner_binding.
**Files:** new scripts/governance_local_issuer/fixture_container_preparation.py, fixture_container_assembly.py, fixture_final_seal.py; existing container shared validator with unchanged strict defaults; native synthetic_fixture_producer.c and compilation closure; focused tests.
**Interfaces:** prepare_fixture_container/verify_fixture_container; assemble_fixture_container_inputs/verify_fixture_assembly; capture_fixture_seal_baseline/validate_fixture_postseal.

- [x] Write RED cases for old-v2 rejection of v3, exact twelve-app-plus-external-Node inventory, source/receipt mismatches and disallowed changes.
- [x] New v3 preparation wrapper binds authentic v2 static-main preparation/compile as a prerequisite, never relabels old evidence. New fixture-base-inputs/3 and materialization/3 flow through shared validation with private fixed constants; legacy public defaults unchanged.
- [x] Implement fresh derived copies and pure postseal validation; no actual historical target mutation or signing executor.
- [x] Add failing actual-body mocked native tests for root bind/current ordering and fixed posix_spawn file actions. Preserve private pipes, selected argv/env/cwd/signals and owned-unreaped cleanup/unknown behavior. Never execute the real target.
- [x] Run relevant new/compatibility tests and compile-only checks; preserve failed observations and exact scope.

## Task 3 — integration and independent review

**Owners:** root integration; qualification_review independent verification.

- [x] Verify exact API/constant agreement and source provenance across source builder → main materialization/3 → manifest → separate delivery receipt → v3 inventory → allowed seal changes.
- [x] Specifically test absence of the digest cycle, immutable v2 defaults, fixed shared dependency preimport order, external Node identity and resource ACL protections.
- [x] Independently review the complete source diff. Fix important findings through targeted failing-then-passing regressions; do not repeat unrelated passing suites.
- [x] Save source hashes, test/compile classes, remaining operational gates, numbered board progress and local recovery bundle. Preserve master user additions and all21 parents.

## Decision rulings

- Separate final delivery receipt is mandatory because main materialization SHA participates in the package manifest/digest; embedding that digest in the same receipt would create a cycle.
- Native parent root checks plus fixed posix_spawn were selected because bind_root invokes Foundation/Security; merely moving those calls into a fork child does not establish fork safety.
- A fixed Prisma external map plus anchored full-verifier banner reuses the same generated client/engine closure; copying the emitted helper alone or adding ambient app/node_modules is insufficient.

## Closing local result

Final combined root batch:25Python cases +3mocked-emitter cases PASS; compile-only/fake-native evidence and independent closing review bound in docs/recovery/2026-11-05/governance-fixture-delivery/verification.json. Tests added after mechanical wiring are explicitly not claimed test-first. Actual artifact generation/signing/installation/resources/custody/consumer/fleet/fullGovernance remain OPEN; no operational action is authorized by this checklist.
