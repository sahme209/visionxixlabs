# Operational Platform Releases Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task, inline as already selected by the owner. Continue without redundant checkpoints; one fresh whole-branch source review at the end, not per-unit reviews.

**Goal:** Connect owner-click release evidence, exact ECS workload delegation/rollback and protected Vercel settings operations without unmanaged credential/write entrypoints.

**Architecture:** Extend the existing dedicated platform scope/current-authority/action/effect conventions with closed operational manifests, private qualified source/workload suppliers and exact typed receipts. Manual owner handoff is a notice, not provider execution or programmatically verified owner permission. Source/profile/custody suppliers remain unavailable unless genuinely qualified.

**Tech Stack:** Existing TypeScript/Zod/Prisma/PostgreSQL/Vitest/scoped credential envelope; no new dependencies.

**Spec:** docs/recovery/2026-11-12/platform-governance-scope/OPERATIONAL-RELEASE-DESIGN-PROPOSAL.md (owner approved local implementation and isolated tests November12).

## Global Constraints

- Local source/schema/synthetic crypto/workload/provider/owned isolated SQL only; no real credentials, provider action, workflow run, production settings/schema/flags, deployment, grants, signing/install or spending.
- One coherent platform branch/PR; all exact-head applicable CI green; owner clicks production. No historical packet/pin/issuer qualification renewal.
- Owner identity stays external/attested. Current platform-admin membership never means owner permission.
- Workload targets an already-created exact run/attempt; no first-match redemption, public nonce capability, borrowed human session or static token fallback.
- Unknown claim/send/receipt/credential lifetime stays consumed/held; no automatic rollback, redeploy, resend or source/approval renewal.
- Pending image/template/deployment designs retain their own approvals; no implicit implementation grant. Do not modify/dispatch unrelated CI/release controls.

## Review Focus

- An admin impersonates the owner: manual notice always reports external_not_verified or owner_attested, never deploy permission (Task1/2/5).
- A different workflow/run/attempt reuses exact approval: actual private identity/delegation and native-target generation must match before credentials (Task3/4).
- A timeout masquerades as terminal failure: rollback remains unavailable without qualified exact failure proof (Task1/3/4).
- Secret artifacts or environment lists are substituted: exact manifest/private envelope/child binding refuses without value/hash leakage (Task1/3/4).
- Role/source revocation or unknown commit during an await: no output/credential/send capability is restored; old history remains inspectable (Task2/3/4/5).

## Task1 — exact operational manifests and pure eligibility

**Files:** create lib/governance/platform/operations/contracts.ts, kernel.ts and __tests__/contracts.test.ts, __tests__/kernel.test.ts.

**Interfaces:** export strict schemas/types `operationalReleaseManifest`, `operationalEcsManifest`, `operationalSettingsManifest`; `compileOperationalManifest(raw): OperationalManifest`; `matchesOperationalRollbackFailure(manifest,raw): boolean` compares only structural receipt lineage; it is never authority. Pure helpers distinguish notice/evidence from provider authority and refuse unknown/waiter errors. No I/O/default supplier or enabled execution.

- [x] RED closed source/project/team/production manifest and artifact/CI/schema/recovery references; reject claimed owner/green booleans, wrong branch/source, secret-bearing fields and caller proof.
- [x] RED exact canonical account/region/ARN/task definition, fixed workflow/source/run/attempt/delegation metadata, distinct force/rollback and exact qualified condition; no unknown-timeout rollback.
- [x] RED settings exact environment/name/type/artifact references and nonsecret digest; reject implicit all-environment scope, duplicate physical targets, secret/plaintext/ciphertext/public secret hash fields.
- [x] Implement only existing Zod/hash/freeze conventions and bounded closed interfaces; compile immutable metadata, never qualify its source or caller.
- [x] GREEN focused checks/root types; commit source and scoped evidence.

## Task2 — current-source manual release preparation and notice/history

**Files:** operations/releasePreparation.ts, releaseService.ts, proposed local schema/fixture additions as needed, platform current authority/repository composition; tests releaseService.test.ts and owned SQL cases.

**Interfaces:** `prepareManualRelease(selection,principal,requestId)`, read-only original-reference lookup/preview/history, exact independent review and requester-only one-attempt notice. Private receipt source suppliers only; no client booleans/owner identity fallback. Result explicitly notice_recorded/provider_execution:false/owner authorization external or attested.

- [ ] RED actual current requester/reviewer/source/expiry checks, exact source/CI/schema/build/recovery metadata, duplicate/concurrent save/notice, unknown recording and revoked-reader history.
- [ ] Implement immutable references/evidence and atomic notice/events under DB time/current authority. Keep actual owner click external; no Vercel mutation/credential path.
- [ ] Add qualified exact-ID read-only deployment result supplier interface; distinguish accepted/pending/verified READY/owner_attested/unknown, refuse unqualified default.
- [ ] GREEN synthetic composition and actual fresh owned SQL with no production resources; stop fixture. Update evidence/docs; commit.

## Task3 — exact workload delegation, target liabilities and protected settings artifacts

**Files:** operations/workloadIdentity.ts, delegation.ts, reservationStore.ts, settingsArtifact.ts; proposed local schema/fixtures; tests for private identity/replay/crypto/SQL.

**Interfaces:** private authenticated workload handle (never JSON), exact-run delegation claim, generation-bound native target reservation, private scoped artifact intake/reference. Actual suppliers fail unavailable until qualified; synthetic ports stay explicit in tests.

- [ ] RED wrong issuer/audience/repo/workflow/source/run/attempt/lifetime, human-token/static-token fallback, self-review, consumed delegation and changed current humans/source/expiry.
- [ ] Implement pre-credential one-use delegation bound to actual exact run and original human approvals; record issued/pending/unknown credential lifetime with no fake recovery.
- [ ] RED cross-action target clones/concurrent claim/unknown generation; settings ciphertext/account/environment/action substitution and metadata/secret leak.
- [ ] Implement reservation/receipt/artifact SQL and scoped synthetic encryption without actual key access. Do not depend on pending deployment-recovery implementation without its separate approval; keep that integration refused.
- [ ] GREEN pure/crypto/actual isolated SQL; stop fixture, preserve all unknown history; commit.

## Task4 — real default effect/legacy entrypoint composition

**Files:** operations/ecsExecution.ts, settingsExecution.ts, sourceProfile.ts, typed observation boundary; `.github/workflows/axiom-deploy-aws-ecs.yml`, scripts/setup-vercel-env.mjs, scripts/setup-oauth.sh; actual default/bypass tests.

**Interfaces:** exact admitted force/settings dispatch and typed immutable result; separately reviewed conditional rollback; explicit unavailable default for unknown provider/workload/secret profiles. No arbitrary role/target input or automatic compensation.

- [ ] RED actual old entrypoints reach secret/CLI/OIDC/provider seams without exact action; refusal before those seams, with tests using synthetic binaries/providers only.
- [ ] RED force sends reviewed task definition explicitly; waiter error/timeout/unknown cannot authorize rollback; typed target/result/epoch mismatch and observation failure halt later effects.
- [ ] RED each settings physical write bound to exact environment/name/private artifact/current revision; no delete/add pre-step, broad environment expansion, plaintext output or automatic deploy.
- [ ] Connect private current authority/delegation/lease/reservation/final-send/observation; enforce maxAttempts1 and bounded qualified read-only polling. Source-qualified profile unavailable means no allow path, never an invented conditional API guarantee.
- [ ] Retire unmanaged entrypoints within the connected replacement batch. Preserve unrelated CI/free runners/publication checks; no actual workflow run or provider operation.
- [ ] GREEN default simulations and owned SQL journeys; record explicitly which real suppliers remain unqualified; commit.

## Task5 — joined operational workflow and honest customer evidence

**Files:** prepared operational HTTP/client/panels, existing platform coordinator, internal demo/docs/remaining-work/current coverage; tests and real in-process client→default HTTP→HMAC/SQL journeys.

**Interfaces:** source preparation/original-reference recovery, independent decision, requester notice or exact delegation confirmation, bounded immutable result/unknown history. No owner impersonation, secret history, provider authority from UI props or automatic workflow dispatch.

- [ ] RED notice is not deploy, exact source and next step visible, workload run already known, result/expiry distinctions, lost-response no resubmit and account-context cancellation.
- [ ] Connect prepared transports/panels with escaped source and nonsecret artifacts; unavailable suppliers show truthful remaining steps. Owner attestation never means verified provider READY.
- [ ] GREEN types/component/transport/owned SQL; internal demo and source-backed docs updated without shipping/activation claims; commit.

## Task6 — complete original P01 audit and one green PR

- [ ] Audit every spec section and managed/default/operational effect, including remaining other-family approval dependencies; never substitute retirement/fail-closed profiles for completed usable coverage.
- [ ] Run matching full ordinary tests, root/production/desktop types/builds, actual owned SQL and necessary isolated acceptance; preserve scopes/failures; no passing-check repetition without new changes.
- [ ] One fresh independent whole-source review; address important findings with regressions, then one coherent PR and all exact-head applicable CI green before normal merge.
- [ ] Production/native/live/owner/flag/database/provider/workload acceptance remains separately authorized, not complete because source merged.

## Self-review

Spec manual owner/evidence boundary maps Task1/2/5; exact workload/delegation/lease and conditional rollback map Task1/3/4/5; settings private manifest/physical writes map Task1/3/4; retirement and all-family evidence map Task4/6. Five review-focus classes are explicitly tested in their owning tasks. Existing schema/source/receipt dependencies are source-verified during implementation rather than guessed or repinned. No independent subsystem or held real-world requirement is removed from the full goal.
