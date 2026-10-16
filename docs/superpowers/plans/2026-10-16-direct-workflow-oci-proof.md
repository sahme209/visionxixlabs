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

- [ ] Verify immutable upstream license/blob plus cached workflow/bundle/index hashes; retain exact assets and provenance note.
- [ ] Add genuine direct fixture acceptance plus profile/identity/subject/crypto/lifetime/context mutation assertions; run focused test and record expected missing-profile RED.
- [ ] Implement explicit profile validation and exact direct identity/buildType/builder binding, preserving old branch byte semantics.
- [ ] Run new and existing genuine reusable verifier tests GREEN; no mocked crypto success.

### Task 2: Actual bounded reader composition

**Files:** Modify `lib/releaseops/ecsReleaseV2/githubBuildEvidence.ts`; create `__tests__/directWorkflowGithubEvidence.test.ts` reusing only fixture data; retain original reader tests.

**Interfaces:** `createGithubBuildEvidenceReader` and its output remain unchanged. Reader inspects the configured profile discriminant; no request profile input is added.

- [ ] Add real-reader/real-crypto test with synthetic metadata and absent/empty referenced workflows; observe expected reader RED after Task 1.
- [ ] Add wrong/mixed metadata, exact current source/ref/attempt, workflow blob and context/config drift tests; keep download/deadline negatives.
- [ ] Implement direct caller run comparison only for the new profile; preserve reusable requirement and all existing bounds/current checks.
- [ ] Run new and existing reader regressions GREEN. Use guarded in-process HTTP simulation; no external requests.

### Task 3: Frozen reviewable evidence

**Files:** Update this plan, spec and relevant internal release/desktop scenario in `lib/demo/demoScenarios.ts`; create concise acceptance/provenance receipt without rewriting historical evidence.

- [ ] Run focused verifier/reader/runtime/demo tests, scoped zero-warning lint, isolated affected-source types and diff checks.
- [ ] Record RED/GREEN counts, source/dependency qualification, genuine crypto versus synthetic metadata and unresolved ECR/executor limits.
- [ ] Freeze clean source commit and return exact SHA to root for independent security review. Do not push/integrate or claim full gates before root runs them.
