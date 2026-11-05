# Connected runtime implementation verification tasks

Prepared commands/test specification only; NOTHING below was executed for this document. Pending local implementation approval is not inferred. Work against the exact approved source and fresh owned test evidence directories; never run an operational target to check whether a command is safe. This plans the joined source unit, not another master audit or operational test packet.

## 1. Freeze test admission before RED

- [ ] Inventory every selected test's subprocess, native import, database and syscall behavior. Fully mock process launch/signals, SQL, Security/XPC, root/file-policy/barrier calls and random material production where the test can reach them. Install broad safety mocks before any failing assertion, not after the first RED. Preserve expected missing-export/module/state failures separately from accidental import/tool errors.
- [ ] Record the existing suites below as compatibility baselines; do not rerun the full repository or a giant package build. Each worker owns finite new test cases. After independent review, one combined affected selection is enough unless a new failure/change requires a targeted repeat.
- [ ] Keep operational binaries0600 and unrun; execute only separately named pure/stub test binaries after their actual import surface is inspected. Existing native mock compilation links framework constants; that fact does not prove all Security functions are inert. Inspect unresolved symbols and every test replacement before execution.

## 2. Handler/lifetime/current-request TDD

Existing exact focused command from repository root (future execution only):

```sh
node scripts/run-vitest.mjs lib/desktop/__tests__/releaseProviderMergeExecutionHttp.test.ts lib/desktop/__tests__/releaseProviderMergeOperationHttp.test.ts lib/desktop/__tests__/releaseProviderMergeHttpCores.test.ts lib/desktop/__tests__/privateReleaseMergeComposition.test.ts lib/desktop/__tests__/privateReleaseMergeHttpComposition.test.ts lib/desktop/__tests__/privateReleaseMergeRequestData.test.ts
```

- [ ] Add tests in these actual suites or a separately named new lifetime suite BEFORE changing source: current-request assertion is privately bound to the native-created id, is called before claim/exposure/final PUT, cannot be disabled by request fields, and refuses after broker cancellation/deadline even when JS cancel delivery is delayed. Mock that new native boundary only for local source tests; no local mock is a native-qualification positive.
- [ ] Exercise actual private composition/session codec/store-facing code with all DB methods stubbed, not a replacement protocol executor. Preserve expectedIdentity forwarding, repeated actor/tenant/session resolution, both legacy wrappers, rate limits and history's no-coordinator/credential/provider closure. Include revoked membership/session, wrong tenant, self-review and source/version/connection change at awaited seams.
- [ ] Extend actual bootstrap tests for single lexical dispatch lifetime: admission disabled before disposal; queued notification/late response/retained handler cannot resurrect it; abort all owned requests; one disconnect; setup failure clears state and wipes mutable staging. Root/module/native failure must permanently revoke the canonical epoch; ordinary request cancellation must not renew or reset it.
- [ ] Keep malformed UTF8, decoded duplicate keys, unknown fields, CR/LF/controls, dotted and space-containing custom token IDs, whole4096-byte envelope, nested1024/256-byte body and262144-byte response regressions. Add exact-cap/cap+1 and handler/stream/late-response abort cases only where current tests do not cover the new boundary.

Existing pure VM initializer command:

```sh
node --test packages/verified-issuer-runtime/test/private-bootstrap-initializer.test.cjs
```

This transpiles the actual initializer in a VM and mocks all factories. Update its current close-only surface expectations deliberately. A new canonical-main VM test may simulate actualRoot/native dependencies to verify source branches, but its receipt must label the positive as mocked native/startup; do not add production test hooks or claim a real current issuer from that VM.

## 3. Preserve real claim/lease/intent/send semantics

Select directly affected existing suites after the request-current seam is designed:

```sh
node scripts/run-vitest.mjs lib/desktop/__tests__/releaseProviderMergeCoordinatorCore.test.ts lib/desktop/__tests__/releaseMergeCredentialExposure.test.ts lib/governance/intelligence/__tests__/mergeOutboundIssuer.test.ts lib/governance/intelligence/__tests__/issuerArtifactIdentity.test.ts lib/governance/intelligence/__tests__/mergeOutboundDrain.test.ts lib/governance/intelligence/__tests__/releaseCredentialExposureStore.test.ts lib/tauri/__tests__/releaseProviderMergeStore.test.ts lib/tauri/__tests__/releaseProviderMergeTransport.test.ts
```

- [ ] Real changed production functions must be under test, with rows/remote responses simulated. Before-claim native request failure yields zero claim; after-claim/before-exposure yields zero later exposure/mint; after-intent/before-PUT yields zero PUT with consumed intent retained. After-PUT loss yields unknown/consumed, no automatic resend. Check durable state and counts separately, not just response status.
- [ ] Duplicate/concurrent invocation and restart/recovery retain one-attempt/credential-exposure blockers. Current identity cannot bypass business permission, review, policy or fleet/drain. A returned identity object is not a request grant.
- [ ] Keep old issuer tests for imported/custom instances unavailable while adding discriminated current type tests. Do not replace every family issuer with a generic positive reader; only the reviewed merge adapter changes.

The `.pg.test.ts` suites and `scripts/run-governance-merge-coordinator-postgres.py` are NOT in this local mocked selection: they start/use real PostgreSQL and need separately authorized execution. No DB URL/environment substitution makes them pure.

## 4. Native business protocol and actual adapter coverage

- [ ] Add separately named pure business-state/frame test files; retain `origin_runtime_protocol_test.c` unchanged as the five-op origin regression. Prove one-slot/no-queue, fixed key/type/length validation, monotonically unique native ids, exact connection/epoch/child/nonces, current-request challenge/cancel serialization, expired/foreign/duplicate/late completion and terminal storage lifetime.
- [ ] Add fully stubbed tests of the ACTUAL changed broker/session/guard handlers, not only their pure extracted state model. Cover unsolicited business message versus origin reply routing, actual code-requirement check result propagation, N-API wakeup/promise teardown/main-thread behavior, origin probe independence and full failure cleanup. Stub all dispatch/XPC/Security/process/syscall edges reached; validate mocks prevent effects before running.
- [ ] Existing source-only regression is useful after updating its obsolete literal-closed-gate assertion to the new derived checks; preserve owner-before-supplier, owner checks around reads, ECHILD unknown and sticky revocation tests:

```sh
python3 -B packages/verified-issuer-runtime/native/tests/test_owner_broker_integration.py
```

- [ ] Existing pure origin baseline can be compiled separately using the actual two sources (future only, `$qualification_test_dir` must be a fresh verified owned0700 directory):

```sh
/usr/bin/clang -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined -I packages/verified-issuer-runtime/native packages/verified-issuer-runtime/native/origin_runtime_protocol.c packages/verified-issuer-runtime/native/origin_runtime_protocol_test.c -o "$qualification_test_dir/origin-runtime-protocol-pure-test"
```

Inspect its imports before any separate execution. Choose exact compile/link commands for NEW adapters after filenames/translation units are selected; do not pretend an invented future command has passed. Full owner/broker/helper graphs may be compiled/linked under the requested scope but never loaded/run.

`test_origin_guard_preimport.py` is NOT a pure regression: it compiles a real addon and loads it in actual Node/worker constructors. `canonical-preimport.test.cjs` and `runtime.test.cjs` spawn actual canonical/uncontrolled processes/workers. `verifier.test.cjs` invokes a Python verifier. `package.json`'s wildcard test command includes these. Do not run that wildcard under a pure/mock-only grant; prepare explicitly stubbed tests or obtain the exact additional invocation scope. Historical passes do not extend current permission.

## 5. Fixture producer source tests

- [ ] Add fixed frame codec tests: exact version/generation/key/password role order and lengths, no aliases/duplicate/trailing frame/extra EOF, truncation and output overflow. Native randomness and every pipe/fork/exec/read/write/wait/SQL effect are fake. New generated keys/passwords never enter logs or snapshots.
- [ ] Actual native maintenance path tests must enforce fixed executable/helper/Node/root/generation admission and unrelated-FD closure, bounded held-child ownership, failure/timeout/partial result, wipe/free only after worker completion, and no attempt reuse. Exercise changed actual adapter functions with all OS/Security calls inert; no synthetic operational flag in production.
- [ ] Actual fixed compiled producer source tests must mock explicit Prisma clients and verify exact admin/runtime instances, source-derived SQL recipe/grants and no global/env fallback. Test root-peer `postgres` bootstrap, initdb administrator selection, final-HBA transition/reload/refusal barrier before Adds, runtime SCRAM/exactDB and diagnostic settings validation. Missing/unsupported facts refuse; reload/SQL/item/publish unknown preserves original phase with no retry/adopt/delete.
- [ ] Existing `synthetic_supplier_read_mock_test.py` uses an exact temporary production-body transformation and symbol inspection before running its inert derived test. It will intentionally fail if the literal closed installation_context changes. Update that transformation/receipt deliberately, prove byte-for-byte reversibility and that actual read bodies remain identical; never relax its assertions to silently run real APIs. Retain actual item-inspector coverage, pre/post owner/deadline/item checks, role sizes, allocation wipe and permanently burned denied epochs.

## 6. Types, compile-only closure and final review

- [ ] Create one fresh scoped TypeScript config rooted at the actual repository tsconfig, including index types, issuer adapter, bootstrap/private handler/producer and owned tests. Freeze its dependency paths and `--noEmit --incremental false`. Existing `governance-private-handler-local-implementation/tsconfig*.json` files are historical receipts with materialized dependency paths and relative extends assumptions; copy neither blindly. Confirm the new config actually includes changed modules before recording success.
- [ ] Inventory external canonical-package imports in the actual emitted bootstrap source. The emitter is compilation preparation, not positive native evidence. Running an actual full emitted build remains separately bounded/reconciled; do not invoke the prior4GB packaging/signing path as a typecheck.
- [ ] Independent diff review joins native request-currentness, identity revocation, handler lifetime, fixture phases and actual final transport seam. Preserve original source/currentness/actor/fleet/unknown boundaries and all historical evidence. Record exact RED/GREEN commands/results and initial harness errors truthfully; no planned test is marked executed.

## Interface decisions needed before their first implementation tests

Select exact business namespace fields/types/response/cancel statuses, fresh nonce/request-id encoding, one-slot teardown ownership, N-API event/promise API and private lifetime guard signature. Select how the per-request guard reaches the real claim/exposure/final-send callbacks without public runtime ports; keep the original six-op JSON unchanged. Select exact fixture frame/header and helper status/phase contract, admin/runtime schema rights and complete source-derived schema inputs. Actual numeric principals, final artifact/dependency identities and supported OS/PG facts stay operational inputs, not guessed source constants. These are bounded interop decisions within the reviewed mechanism, not a demand to invent a new architecture.

Later operational testing is [acceptance-matrix.md](acceptance-matrix.md), not any command above: one SAME actual compiled consumer/protected runtime/isolated DB positive plus original adversarial rows, only named provider/credential responses simulated, exact separate installation/material/native execution approval. Source/mock completion cannot claim that matrix, actual custody, fleet or full Governance passed.
