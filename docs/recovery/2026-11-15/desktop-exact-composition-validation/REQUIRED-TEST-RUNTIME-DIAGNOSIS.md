# Required-test security failure diagnosis

2026-11-15. File-only diagnosis; no tests/runtime, build, native app or external service was executed. No security code, fixture, expectation or dependency pin was changed.

## Concrete evidence

The aggregate log preserves19552 passing tests and39 failures. Exactly31 failures belong to **five**, not six, ECSv2 security files:

| File | Failing cases |
|---|---:|
| checkedAdmissionInputs.test.ts |3|
| directWorkflowGithubEvidence.test.ts |17|
| directWorkflowOciEvidence.test.ts |2|
| githubBuildEvidence.test.ts |6|
| sigstoreBuildVerifier.test.ts |3|

The other eight failures are presentation expectations being handled separately. Do not discard the aggregate failure or claim a fully passing suite from it.

The log explicitly shows unsupported_sigstore_runtime where tests expected invalid_verification_time or invalid_or_expired_manifest. Several related cases report zero authority/provider reads; timeout cases wait for credential/read callbacks that are never reached. Existing githubBuildEvidence.inspectBuild and verifyBuildProvenance both refuse on the runtime gate before those operations. This explains the clustered failure shape without a security-regression hypothesis.

The existing sigstoreRuntimeSupported function accepts Node22.22.2+,24.15+ and26+. Installed @sigstore/verify package engines likewise specifies ^22.22.2 || ^24.15.0 || >=26.0.0. **Node25 is intentionally unsupported.** Current shell node resolves /opt/homebrew/bin/node -> ../Cellar/node/25.2.1/bin/node. The repository .nvmrc instead pins24.21.0, whose existing installed executable is /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node. That version satisfies the unchanged gate.

The aggregate log does not itself stamp process.versions.node, so attributing that past invocation specifically to the currently selected25.2.1 binary is an inference. Its unsupported-runtime result is direct evidence; current shell resolution and the unchanged gate/package engines make the runtime mismatch the concrete leading cause. It is not a Node26 incompatibility:26 is explicitly admitted.

Independently hash-compared every31 archived file under lib/releaseops/ecsReleaseV2 against the prior accepted homepage-pointer source manifest; all source/test/fixture hashes match. Git reports no delta in that security subtree. No blanket renewal of security pins is warranted.

## Safe correction recommendation

Run the unchanged five focused security suites using the explicit existing approved24.21.0 Node executable and local Vitest entry, with the runtime identity recorded. Do not rely on PATH's Node25, widen the runtime gate, alter crypto pins, substitute verification results, skip tests or weaken assertions. These use fixed genuine signed fixture bytes and intercepted provider I/O; they do not need network, credentials or a real account.

Preserve this original failed aggregate. A focused supported-runtime pass would establish recovery of this finite test scope only, not retroactively change the aggregate result or prove production/native/provider readiness. Then complete the required ordinary aggregate under the supported pinned runtime when the parent schedules that coherent validation. No cache snapshot should be frozen while tests are still changing test-result metadata.

No focused rerun was necessary to identify the source-supported mismatch during this review; this report does not claim those31 cases are now passing.
