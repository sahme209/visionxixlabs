# Target snapshot compatibility implementation plan and report

> Execution: inline using the executing-plans and TDD skills; root owns independent review, integration, full suite and exact-head CI.

**Goal:** Add an inactive, source-only snapshot target variant to the existing release kernel, with a final Serializable review packet fence.
**Architecture:** Preserve v2 parsing, canonical bytes and integer revision exactly. The same parser/comparison/review/receipt kernel additionally accepts discriminated v3 manifests. Independently loaded target/environment/connection rows feed one canonical projector reused by AWS observation and the final packet transaction; no review-facts producer is introduced.
**Tech Stack:** TypeScript, Vitest, existing Prisma raw SQL Serializable store, owned PostgreSQL rehearsal.
**Spec:** Existing `docs/ECS_IMMUTABLE_RELEASE_PLAN.md`, “Proposed target-snapshot compatibility milestone”.

## Concrete contract

- Keep `ReleaseManifestV2` with protocol `axiom.ecs.release.v2` and its current seven-field target. Export `ReleaseManifest = ReleaseManifestV2 | ReleaseManifestV3`.
- V3 protocol is `axiom.ecs.release.v3`; all manifest fields except target/protocol retain their existing meaning. Target has exactly `{accountId,partition,region,roleArn,clusterArn,serviceArn,snapshot}`. Snapshot has exactly `{schema:"axiom.ecs.target-snapshot.v1",id,digest,connection:{id,version}}`. No revision or optional compatibility shim is accepted in v3; no snapshot is accepted in v2.
- `projectTargetSnapshot(rows: TargetSnapshotRows): TargetSnapshot | null` hashes explicitly selected target fields `{id,organizationId,environmentId,provider,roleArn,region,ecsCluster,ecsService,updatedAt:ISO}`, scoped environment `{id,organizationId,updatedAt:ISO}`, and safe connection fields `{id,organizationId,provider,externalAccountId,credentialRef,regions,enabled,updatedAt:ISO,version}` under the snapshot schema label. It validates exact tenant/environment/account/region association, live credential generation and cloud-v2 binding. Credential ciphertext/external ID are never accepted into the projected material.
- `TargetSnapshotRows` contains independently read `target`, `environment`, `account` and credential identity `{id,organizationId,version,revokedAt}`. The projector excludes credential ciphertext entirely. The digest is equality identity only; no monotonic generation/ABA guarantee or provider authority.
- Extend the existing scoped-connection operation callback with a third, safe row-snapshot argument (no ciphertext/external ID). Existing consumers taking two arguments remain unchanged. The AWS reader produces the shared snapshot after its existing pre/post IO fences, retaining explicit observation limits.
- `ReviewTransaction.currentTargetSnapshot(organizationId,environmentId,connectionId): Promise<TargetSnapshot|null>` reads current environment/target/account/credential in the existing Serializable transaction using static parameterized SQL. It derives the snapshot through the shared projector.
- `prepare` for v3 compares the current snapshot with independently verified facts and candidate before create **and replay** in the final transaction, after provider IO. Missing/drifted snapshot => `current_target_snapshot_unavailable`. V2 never invokes the new snapshot read and retains its old behavior. Current policy and accepted management membership checks remain.
- ReviewFacts remains independently verified caller-internal evidence; no runtime adapter composes GitHub/AWS into ReviewFacts here. Build readers already use the shared parser/types and must continue accepting both variants without certifying AWS state.
- Receipt matching continues exact full-target equality and manifest digest linkage; changing variant/snapshot cannot reuse an old receipt or review packet. Existing decision CAS/quorum/revocation/checkpoint semantics remain review-only.

## Constraints and review focus

No route/flag activation, provider calls/writes, new kernel, production schema/migration, claim/signing/approval/execution authority, or legacy four-input workflow change. No master/canonical tracker edits. No dependency changes or shared Prisma generate. Cached protobuf 0.5.2 differs from locked 0.5.0; clean CI is authoritative.

Tests must cover strict mixed/missing/forged snapshots; every projected field and Date serialization; row recreation and connection replacement/revocation; target/environment/connection drift during provider IO and between observation and final create/replay; exact old v2 hash and receipts; real owned-PG final transaction rollback/read scope. Equality snapshots cannot exclude writes after transaction commit.

## Task 1: Version-aware contract and canonical snapshot producer

Files: `lib/releaseops/ecsReleaseV2/{contract,targetSnapshot}.ts`, contract/snapshot tests, `lib/cloud/aws/{enrollment/scopedConnection,ecsObservation/reader}.ts`, reader tests; test fixture type refinements only where union narrowing is needed.
Interfaces: contract variants and projector above; safe callback row snapshot; reader targetSnapshot uses shared schema.
- [x] Write tests for old v2 golden digest and strict v3 parser/evidence/receipt behavior plus snapshot projection mutations and reader identity/drift.
- [x] Run focused tests and observe intended missing-v3/projector failures.
- [x] Implement contract union, strict variant parsing, projector and reader reuse; preserve byte semantics.
- [x] Run contract/snapshot/reader/enrollment focused tests; expected all pass.
- [x] Update living source documentation/demo together with implementation commit.

## Task 2: Final packet transaction fence and durable regression

Files: `lib/releaseops/ecsReleaseV2/{reviewCore,postgresReviewStore}.ts`, review tests, `scripts/{rehearse-ecs-review.mjs,fixtures/ecsReviewFixture.ts,fixtures/ecsReviewHarness.ts}`, source living docs/demo.
Interfaces: required ReviewTransaction currentTargetSnapshot above; existing store transaction remains Serializable.
- [x] Write tests proving missing/drifted target/connection prevents v3 create/replay, old v2 remains unchanged, valid v3 replay/conflict and current quorum work.
- [x] Run tests; expected failures before the fence implementation.
- [x] Implement scoped SQL row reader and final comparison; no packet schema change.
- [x] Extend owned PostgreSQL rehearsal with synthetic existing target/account tables, v3 create/replay, independent row mutation before final transaction and same-transaction integrity failure rollback; run under owned loopback only.
- [x] Update living docs/demo and run focused suites plus demo contract; expected all pass.
- [x] Commit and provide parent exact changes/test evidence/limitations for independent review and coordinated heavy gates.

## Execution ledger

- Base: merged main `2682ba732ab1bd262dcaa378e3a6e3119d245229`; isolated worktree `/workspace/axiom-target-snapshot`, branch `codex/target-snapshot`.
- Preflight: Task 2 consumes Task 1 TargetSnapshot and projector; signatures match. Reader and PostgreSQL both construct the same allowlisted row material.
- Ruling: a fresh worktree was explicitly required despite the provided checkout already being linked; created a sibling worktree from actual merged main.
- Ruling: full suite/build and fresh reviewer remain root-coordinated per task constraints. Only focused checks run here.

- Root approved the concrete plan before source edits. Task 1 RED: valid v3 rejected (1 failure/75 pass); projector null failed independent canonical expectation; reader returned old id/timestamp and failed canonical snapshot expectation. GREEN: contract+projector+reader+enrollment 200/200. No live providers.

- Task 1 complete: commit `1916b797`; focused 13 files / 306 tests pass. A test-only automated narrowing edit briefly caused a syntax failure; corrected and reran successfully. Fresh reviewer independently confirmed frozen Task 1 with no material findings.
- Task 2 RED: 10 review-core failures demonstrated stale/forged target snapshots still recorded. GREEN: review core 28/28. Final prepare now compares current persisted snapshot before creation/replay; observed facts are detached before the final transaction.
- Owned PostgreSQL17 RED: v3 packet preparation unavailable while the transaction adapter method was absent. GREEN: actual adapter completed native `txid_current()` same-transaction/Serializable assertions, 7 SQL drift cases at create and replay, foreign tenant/environment/connection refusal, and after-INSERT rollback. Existing voter race remained one commit/one rejection. Both fresh owned cached-image containers were removed after ownership-label verification. Logs: `/tmp/target-snapshot-pg-red.log`, `/tmp/target-snapshot-pg-green.log`.
- Focused combined verification: 13 files / 317 tests pass (`node node_modules/vitest/vitest.mjs run lib/releaseops/ecsReleaseV2/__tests__ lib/cloud/aws/ecsObservation/__tests__/reader.test.ts lib/cloud/aws/enrollment/__tests__ lib/demo/__tests__/demoScenarios.test.ts --reporter=dot`). Existing Vite CommonJS config-loader warning remains.
- Scope: no schema/dependency/provider/route/workflow changes; source packet protocol and existing inactive review lifecycle only. Source-only facts composition remains absent. Production SQL and operational release acceptance remain separately gated.
- Parent owns final independent review, coordinated full compiler/suite/build and exact-head clean CI. No shared Prisma generation. Runtime overlay protobuf 0.5.2 versus lock 0.5.0 remains disclosed; tests do not replace clean install CI.
- Task 2 complete: source commit `693a728c`. Fresh independent reviewer approved the full frozen branch and Task 2 delta with no material findings, including inspection of owned-PG RED/GREEN traces. No source edits were required by review.
- Coordinated compiler window: Node `v24.19.0`; web `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed without diagnostics; desktop `node node_modules/typescript/bin/tsc --noEmit` passed without diagnostics; desktop `npm run build` passed release alignment, TypeScript and Vite production bundling. Existing Tauri plugin-shell mixed static/dynamic import warning remains. Logs: `/tmp/target-snapshot-web-tsc.log`, `/tmp/target-snapshot-desktop-tsc.log`, `/tmp/target-snapshot-desktop-build.log`.
- Final changed runtime files: existing contract, new pure snapshot projector, existing scoped-connection callback/observation reader, existing review core and PostgreSQL adapter. Tests/fixtures/rehearsal and living durable-review/demo documentation accompany them. Schema, migrations, legacy four-input workflow and template are byte-unchanged from base. No provider calls, public route/flag, production writes, dependency edits, Git pushes or PR/merge operations were performed.
- Remaining integration gates: parent-coordinated full web regression/build and exact-head clean-install CI. Equality snapshots do not provide historical ABA or post-commit protection; checkpoints remain stored review evidence, and independent GitHub/AWS-to-ReviewFacts composition and actual execution claims remain absent.
