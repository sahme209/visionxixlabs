# Enrolled merge preparation and actual coordinator qualification

November 2, 2026 · local correction on base `784c022a362d2df2e05b02d5711bffd8e2f33b27` plus the source hashes below. No production deployment, provider action, schema/grant change or enrollment/coverage registration.

## Corrected existing source path

The normal coordinator previously selected V2 only during `run`; its `prepare` method always used the uncovered refusal when no injected guard was supplied. Actual enrolled preparation therefore failed despite a current independently approved baseline-bound decision. Genuine normal-prepare PostgreSQL RED: four cases refused through that old fence, `/private/tmp/axiom-merge-enrolled-prepare-red-pg.log`.

The [actual coordinator](../../../lib/desktop/releaseProviderMergeCoordinator.ts) now derives its prepare scope from the exact current reviewed canonical parent and stored release. It verifies parent identity/digest/state, reconstructs the real release scope, and warms the actual current evidence **outside** the later configuration/operation transaction. Any organization enrollment with no selected-scope enrollment refuses; no alias or legacy fallback is inferred. An unenrolled caller retains the existing refusal fence.

Inside the actual store's first authority callback, the same organization lock is taken first. Actual locked enrollment/source proof must still match the warmed exact baseline. The actual canonical/audited approval reader must return that exact saved baseline digest; absent or substituted digest cannot be attached retroactively. Existing participant, connection, source, plan and one-attempt validation remain. Preparation issues/consumes no approval, requests no credential and performs no merge. Actual V2 claim and final write admission remain separate.

Private initial executor/source freshness and the original reviewer's expiry survive later DB awaits and preparation result delivery. The reviewer session comes only from the real purpose-bound approval reader's validated authority callback into a private WeakMap; no copied DTO/stored SID alone establishes it. A genuine additional RED demonstrated that requester expiry refused but reviewer expiry during post-COMMIT delivery initially still returned prepared data: `/private/tmp/axiom-merge-enrolled-prepare-session-red-pg.log`. The corrected closure withholds the result for either expired original session. After COMMIT, the already saved prepared record and unconsumed approval remain; no rollback or new execution permission is claimed. Independent current source review found no material issues.

## Actual local composition and exact limits

[New PostgreSQL suite](../../../lib/governance/intelligence/__tests__/mergeCoordinatorEnrolled.pg.test.ts) calls **actual coordinator.prepare then actual coordinator.run**, with no injected Governance guard and no canonical-store prepare shortcut. Actual requestService, document upload/head/artifact/source revalidation, active baseline, numeric policy, purpose approval, paired-role/session rows, V2 guard, opaque installation eligibility, read-only token/policy/topology readers, write preflight, exposure ledger/helper and fixed transport compose.

Only the closed fixture wraps the requestService factory's coverage method: it calls the actual original method, asserts its returned action list remains empty, then supplies the explicit simulated `repository.merge` action for an actually enrolled scope. A negative disables this extension and verifies the actual empty production result still refuses. Fixture activation is explicitly simulated through the revision store's test-only verifier ports. Pairing/commercial responses, initial human decisions, GitHub configuration/RSA signature and fixed provider responses are simulated. No production positive verifier/default is added.

The positive case verifies actual read-only token profile/source/metadata before claim, zero write-token requests before the committed claim, a real pending credential exposure before the actual write-token response, exact returned expiry persisted as issued, no secret persisted, exactly one write grant/PUT and no remint/resend on re-entry. Terminal enrolled `run` re-entry is currently refused by the existing prepared-only binding reader; observation/history remains a separate read. This receipt does not claim a new replay-history behavior or real human/provider acceptance. Provider fixtures independently acquire the operation and parent locks NOWAIT, proving provider IO does not execute under those locks.

## Receipts

- Eight actual PostgreSQL cases passed together: `/private/tmp/axiom-merge-enrolled-coordinator-pg.log`. Positive prepare/V2 run; missing eligibility metadata and changed read-only grant profile; production-empty coverage refusal; missing exact baseline on approval; organization-enrolled/selected-scope-absent refusal; executor and reviewer expiry after committed prepare delivery.
- One additional targeted actual PostgreSQL case passed with the other eight intentionally skipped: `/private/tmp/axiom-merge-enrolled-source-head-pg.log`. It changes the **actual durable document head** after the real outside-lock source warmup and verifies locked source revalidation refuses before a prepared operation/exposure is saved. No fake source proof is returned. These are separate receipts, not a falsely asserted combined nine-case run.
- Scoped new-test/coordinator dependency TypeScript passed: `/private/tmp/axiom-merge-enrolled-coordinator-types.log`. Changed-file diff check passed. One scoped coordinator unit run passed22 tests, `/private/tmp/axiom-merge-enrolled-prepare-unit.log`. Root's later broader-filter regression passed56 files/745 tests with7 files/106 tests intentionally skipped, `/private/tmp/axiom-enrolled-prepare-coordinator-unit.log`; skipped cases are not executed proof.
- Eight-case owned fixture `/private/tmp/axiom-execution-policy-pg-z1k826zl` and targeted-source fixture `/private/tmp/axiom-execution-policy-pg-k6awf7jn` stopped. Independent `pg_ctl status` returned **no server running** for both. Earlier failed/red fixtures were also stopped by their harness finally blocks.

[Tracked reproduction harness](../../../scripts/run-governance-merge-enrolled-postgres.py) is a byte-for-byte copy of the tested owned harness; no duplicate run was needed for that copy. It creates a private socket/generated schema using existing tables only, rejects remote/production bindings, runs the nine current cases and always stops its own database. It performs no migration/provider/CI/deployment work.

Remaining blockers include complete mutation/alternate-caller coverage, actual durable outbound intent wiring, provider-effect quiescence, old credential/mixed-runtime qualification, genuine native/human acceptance, live authority/provider validation and supported shipped availability. Production coverage remains empty/refused; this correction/fixture does not complete Governance or authorize activation.

## Exact changed source hashes

| File | SHA-256 |
| --- | --- |
| `lib/desktop/releaseProviderMergeCoordinator.ts` | `9996be5bb1f78079158147de21225113f9320c28468c8509b20c22461655d321` |
| `lib/governance/intelligence/__tests__/mergeCoordinatorEnrolled.pg.test.ts` | `2ab6a27d18c08a5ecd0ff922c1d95fa599abd731d18a1af5c36d58bc76b038c4` |
| `scripts/run-governance-merge-enrolled-postgres.py` | `fd77086d4abec448ea2ba690ad70f1d0b781081f234bb6ffe34097e3970eb077` |
