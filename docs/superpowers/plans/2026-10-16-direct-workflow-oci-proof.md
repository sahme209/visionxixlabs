# Direct-workflow OCI proof implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; root explicitly prohibits subagents and owns independent review and integration.

**Goal:** Accept the genuine direct-caller OCI proof through an explicit internal profile while preserving immutable reusable verification.

**Architecture:** Extend only the existing verifier/profile closed union and existing bounded GitHub reader. Retain exact upstream fixture bytes and real official crypto. No activation, execution authority or ECS kernel change.

**Tech Stack:** TypeScript, installed official Sigstore packages, Vitest, existing bounded GitHub fetch.

**Spec:** `docs/superpowers/specs/2026-10-16-direct-workflow-oci-proof.md`.

## Global constraints

- Only verifier/reader production modules change; no contract/target/review/AWS/Airflow/schema/dependency or legacy workflow changes.
- Existing reusable profile stays strict. Direct kind is `public_sigstore_direct_workflow_v1`, seven exact fields; exact pinned signed identities, older direct build type, signed builder ID; all current OIDs/crypto/authority/budgets retained.
- Fixture bytes require exact upstream provenance and CC0 license; no payload layers, signatures fabricated by tests, defaults or production trust.
- Light offline tests/focused types/lint only until root schedules full gates; no real provider calls or deployment.

## Review focus

- A mutable-ref SAN must never replace the separately checked signer/source/caller SHA: verifier mutation coverage in Task 1.
- A profile fallback or expanded build-type allowlist must not weaken the original reusable profile: cross-profile negatives in Task 1.
- Wrong complete subject sets or registry renaming must not become OCI/ECR authority: exact set/substitution tests in Task 1.
- Mixed direct/reusable run metadata must not infer trust or skip current context checks: Task 2.
- Simulated GitHub metadata and real crypto must stay distinguishable from live provider/executor acceptance: Task 3 documentation and evidence.

### Task 1: Genuine direct verifier profile

**Files:** Modify `lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier.ts`; create `__tests__/directWorkflowOciEvidence.test.ts` and dedicated fixture helper/assets under `__tests__/fixtures/`; retain `__tests__/sigstoreBuildVerifier.test.ts`.

**Interfaces:** Preserve `PublicTrustProfile`; add `DirectWorkflowPublicTrustProfile` and `ReviewedPublicTrustProfile`; `inspectPublicTrustConfiguration` returns that union. `verifyBuildProvenance` output is unchanged.

- [x] Verify immutable upstream license/blob plus cached workflow/bundle/index hashes; retain exact assets and provenance note.
- [x] Add genuine direct fixture acceptance plus profile/identity/subject/crypto/lifetime/context mutation assertions; run focused test and record expected missing-profile RED.
- [x] Implement explicit profile validation and exact direct identity/buildType/builder binding, preserving old branch byte semantics.
- [x] Run new and existing genuine reusable verifier tests GREEN; no mocked crypto success.

### Task 2: Actual bounded reader composition

**Files:** Modify `lib/releaseops/ecsReleaseV2/githubBuildEvidence.ts`; create `__tests__/directWorkflowGithubEvidence.test.ts` reusing only fixture data; retain original reader tests.

**Interfaces:** `createGithubBuildEvidenceReader` and its output remain unchanged. Reader inspects the configured profile discriminant; no request profile input is added.

- [x] Add real-reader/real-crypto test with synthetic metadata and absent/empty referenced workflows; observe expected reader RED after Task 1.
- [x] Add wrong/mixed metadata, exact current source/ref/attempt, workflow blob and context/config drift tests; keep download/deadline negatives.
- [x] Implement direct caller run comparison only for the new profile; preserve reusable requirement and all existing bounds/current checks.
- [x] Run new and existing reader regressions GREEN. Use guarded in-process HTTP simulation; no external requests.

### Task 3: Frozen reviewable evidence

**Files:** Update this plan, spec and relevant internal release/desktop scenario in `lib/demo/demoScenarios.ts`; create concise acceptance/provenance receipt without rewriting historical evidence.

- [x] Run focused verifier/reader/runtime/demo tests, scoped zero-warning lint, isolated affected-source types and diff checks.
- [x] Record RED/GREEN counts, source/dependency qualification, genuine crypto versus synthetic metadata and unresolved ECR/executor limits.
- [x] Freeze clean source commit and return exact SHA to root for independent security review. Do not push/integrate or claim full gates before root runs them.

## Observed execution evidence

Spec/plan persisted at `4b726865` before production changes. New actual verifier tests were RED with two expected failures (missing direct profile and absent post-crypto authority check); 33 negatives/fixture checks already passed. New direct reader tests then showed 15 expected failures because the original reader required reusable signer metadata; 14 closed negatives already passed. After the two bounded production changes, 134 tests in five verifier/reader/runtime files passed. Final focused verification including living-demo contracts passed **149 tests across six files**. Real official crypto uses the unchanged genuine upstream signatures; GitHub HTTP metadata, current state and installation token remain synthetic. Scoped ESLint with `--max-warnings 0`, isolated affected-source/fixture types and `git diff --check` passed. Root's whole-application gates and independent security review remain pending.

Immutable upstream public license/commit-tree/workflow provenance was read only with explicit root authorization. `LICENSE.txt` at the pinned source is CC0-1.0, not an assumed CLI license. No image layers, workflow runs, provider writes, dependency install, full compiler, server or Postgres were used. Installed overlay remains protobuf-specs 0.5.2 versus lockfile 0.5.0; clean CI is authoritative. The exact frozen-source receipt is recorded separately after committing production bytes; documentation commits do not pretend to be additional runtime acceptance.

Frozen runtime source: `f2b482947c11783d6e0bd93bd1eca7d6bab72f18`. A second focused run at that committed source passed 149/6 with 13 source/fixture hashes asserted unchanged before and after. `docs/mission/local-direct-workflow-oci-proof.json` records exact binding, genuine proof versus in-process metadata simulation, dependency qualification and remaining gates. No server or database was started; no fixture resource requires cleanup. Final documentation is evidence-only after the frozen production commit.
