# Merge outbound integration gates: design-only mapping

Provenance: source snapshot `a1af01a0746ee7fd89d774030129f423596c86b0`, inspected 2026-11-02; exact source hashes appear below. Preserved from the local work-only source audit. This is a design-only integration gate and test proposal, not grant approval, implementation, provider qualification, manifest authority or activation evidence. Canonical CJS external-consumer fail-closed groundwork is a separate increment; it does not supply real issuer identity. Actual outbound runtime adoption remains pending a real issuer consumer and trusted artifact identity. Package/artifact work is separately owned; this document changes no package files.

## Exact existing seam

- `lib/desktop/releaseProviderMergeCoordinator.ts:108-116` builds the actual transport and selects V2 governed or positively unenrolled execution. Adoption must cover both actual wrappers; injected test guards cannot constitute production coverage.
- `lib/governance/intelligence/governedProviderMerge.ts` claims through the actual merge store before invoking the fixed transport. The corresponding uncovered wrapper is a separate required adoption caller.
- `lib/tauri/releaseProviderMergeStore.ts:195` exposes DB-only `assertClaimedCredentialAuthority(tx, scope, operationId, exactPlan)`: canonical row/history/binding, dispatching state, consumed single attempt, original participants, current parent/source, exact plan hash, lease/window/approval expiry. It returns retained private freshness. It does not grant drain authority or prove artifact identity.
- `lib/desktop/releaseMergeCredentialExposure.ts` already reserves actual credential exposure before mint, binds actual installation/revision/plan/source, and records actual issuer expiry. Keep it independent of effect slots: token expiry never completes an outbound effect.
- `lib/tauri/releaseProviderMergeTransport.ts:54` invokes trusted optional `beforeSubmission(operationId, exactPlan, signal)` once after credential/policy/target preparation and final current authority. `jsonRequest` consumes returned function synchronously immediately before the sole PUT, followed by original final authority. No submission hook on repeated authority checks or GET/readback. Hook existence currently is not adoption.
- `lib/governance/intelligence/enrollmentDrainStore.ts:93-107` reserves under org lock with exact current operation proof, stores null pre-barrier epoch, rechecks epoch/barrier during intent CAS, and publishes one-use freshness only after real transaction/result delivery. Historical slots remain blocking across epochs. `observeQuiescent` requires a separate verifier; arbitrary digest is insufficient.

## Proposed exact server mapping (pending actual issuer consumer)

A new merge-specific integration helper should own the binding privately, not accept it from HTTP/serialized plan fields. Canonical input is the actual claim result plus server scope and verified artifact provider.

| Drain field | Proposed derivation / verification |
| --- | --- |
| scope | Existing exact paired organization, actor and original canonical session used by actual claim; no request-body organization/session. |
| operationId | Actual canonical `release_merge_provider_<digest>` returned by claim; verify with real store, not prefix alone. |
| attemptId | Deterministic identifier derived from canonical operation ID and the store's sole consumed attempt `1`. A retry cannot allocate another effect attempt. Exact encoding is new local metadata, not new permission. |
| serverNonce | Server-generated UUID once per successful claimed request; retain only in that request. Claim false/replay cannot reserve another slot. Crash leaves the existing slot blocking; recovery never reclaims/remints/replays. |
| profile | Explicitly registered fixed GitHub direct merge profile, constrained to `expected_head_observed_base`, actual merge method and supported fixed transport. No existing drain profile registry currently supplies this name: agree its exact identity before code; do not equate governance action `repository.merge` with quiescence qualification. |
| targetDigest | Hash canonical object containing organization, repository full name, numeric PR, head ref and base ref. Reconstruct from canonical stored exact plan. |
| connectionId | Canonical plan connection ID, with real current installation/revision verification retained by existing claimed authority. |
| sourceDigest | Hash canonical object containing full plan digest, connection revision, exact head/base SHA, source policy and merge method. Include current release/governance source through exact plan/current-store verification; do not infer it from a caller-supplied digest. |
| issuerArtifactDigest | Mandatory actual trusted artifact-provider output pinned to the exact executing issuer/runtime. **Currently unavailable.** No git HEAD, environment variable, constant, placeholder digest or self-reported package identity may stand in for it. |

`verifyOperation(tx, scope, binding)` must reconstruct and compare every mapped field from the private pinned canonical plan/claim and verified artifact evidence; call real `assertClaimedCredentialAuthority` in the same supplied transaction and retain its closure. The store's generic current `reader` authority alone is insufficient. A server nonce is identity, not proof. Artifact evidence needs its own trusted retained current verifier; absent provider refuses adoption rather than supplying a fake verifier. Do not perform provider/artifact fetch under the org lock. Existing source-policy/provider proofs stay in original final transport authority and keep their original TTL; do not refresh or replace them with DB flags.

## Mandatory sequencing

1. Preserve actual V2 read-only eligibility and atomic one-attempt claim; zero write-credential requests before claim. Legacy path retains its explicit unenrolled checks.
2. After successful claim, before actual credential mint, reserve the exact effect slot using real drain store + the verifier above. Failure consumes the merge attempt without mint/PUT; do not reset outcomes. An effect reservation is not a replacement for the separate credential-exposure reservation.
3. Keep the exact reserved slot privately attached to the claimed request. Existing provider prep/read-only GETs run outside locks. Concurrent drain beginning after reserve makes intent refuse; reserved remains a blocker unless a separately supported no-submission proof can safely close it.
4. At the actual fixed transport hook call `markSubmissionIntent(scope, slotId, publishFreshness)`. Require an actual published function; never fall back to void, DTO, marker or absent verifier. Store commits intent before exposing the one-use closure. Retain original transport signal/deadline and claim/session/lease freshness through commit and scheduling.
5. Return that private function to the fixed transport. Existing immediate-before-fetch callback consumes it, then checks original final current authority. No await between this combined callback and fetch. If either proof fails after durable intent, zero PUT but slot remains blocking; never infer no submission merely from a refused transport result.
6. After submission, preserve transport's one PUT/no resend and exact merged receipt. Lost acknowledgment, aborted request, process death, readback failure and result-persistence failure stay durable submission_intent/unknown blockers. Best-effort markUnknown may fail without weakening the existing blocking intent. Never finish the merge operation before a needed claimed-operation verifier runs: terminal store state intentionally is no longer dispatching.
7. Terminal provider observation is a separate bounded read outside locks followed by `observeQuiescent` with exact privately issued observation provenance + DB verifier under lock. Do not reuse claimed-write authority here: a current same-tenant reader can observe after original issuer expires, and the original operation may already be terminal. It must still bind original immutable slot/operation/target/source/profile/artifact and observation, with freshness checked after commit.

## Supported terminal semantics: presently a hard gate

Current fixed transport confirms exact PR repository/number/head/ref, closed+merged and merge SHA equal to the PUT acknowledgment. That proves the direct merge response/readback only. It does not prove triggered Actions, webhooks or other downstream effects stopped. A lost PUT acknowledgment cannot be reconstructed from today's confirmed receipt path by guessing a merge SHA. Therefore initial adoption can safely leave all submitted slots blocking, but must not call `observeQuiescent` or enable activation until an approved profile defines and verifies the complete effect boundary and any spawned work inventory. A narrower direct-PR effect profile alone cannot hide those other effect families. UNKNOWN never becomes quiescent through time, credential expiry, worker lease expiry, local cancellation or abort-drain.

## Minimal test draft (actual seams, simulated provider explicitly)

1. Real isolated PG store + actual normal coordinator/V2 or actual legacy wrapper + fixed transport: before issuer callback inspect committed reserved effect slot and pending credential exposure; before PUT inspect committed submission_intent and exact binding. Exactly one issuer/PUT; replay reserves/mints/submits nothing.
2. Wrong organization/session/operation/attempt/plan/source/ref/connection/revision/profile/artifact; copied artifact evidence; missing artifact provider: refusal, zero issuer/PUT. Do not mock the operation verifier or artifact validity with a Boolean.
3. Two-connection org-lock races: drain wins before reserve => none; reserve wins then drain => durable blocker and no intent/PUT; intent wins => committed blocker persists and drain cannot activate. No provider fetch while DB transaction/lock is held.
4. Real commit-delivery and final scheduling gaps: original actor/reviewer session, source proof TTL, approval/window/lease, cancellation/deadline expire after intent commit => zero PUT and consumed attempt + blocking slot. Missing/malformed publisher and second closure use refuse.
5. Lost ACK/timeout/cancel immediately after actual fetch; successful ACK but failed exact GET; operation-finish failure; process-restart re-entry: no resend/remint, blocker persists. Expiring token/lease does not clear it.
6. Quiescence negatives first: exact merge receipt alone, arbitrary digest, expired/copied/wrong-target observation, unknown downstream work all remain blocked. Positive quiescence test only after a real accepted profile-specific verifier exists; no fixture Boolean advertised as qualification.

Next implementation remains pending the actual issuer consumer, trusted artifact provider and exact profile/binding acceptance. This document itself approves no grant or runtime wiring. A disjoint new integration helper/tests can then compose existing store/hook without altering claim/approval semantics. Coordinator + both wrappers need coordinated adoption edits; package author owns artifact-provider work separately. No runtime changes were made by this draft.

## Exact audited source bytes

- `lib/governance/intelligence/drainContracts.ts` SHA-256 `63222469c718c34f45c726dfab449fb0aaba70fb0d5f75537416093194956e4a`
- `lib/governance/intelligence/enrollmentDrainStore.ts` SHA-256 `32bbff4b1d2ad7a8bcd2fea19dd2844eae4bbdce51ed04519ef0203ea69de55c`
- `lib/tauri/releaseProviderMergeStore.ts` SHA-256 `9cc3ee4b4d03fd928b82253ee35ad495465b5b64cfc8d825118792ac3b6a0edd`
- `lib/tauri/releaseProviderMergeTransport.ts` SHA-256 `64d12519c4cb3d6beb4d62e21ec603972a46d8758c9d42afd2399c03e509fc97`
- `lib/desktop/releaseProviderMergeCoordinator.ts` SHA-256 `9996be5bb1f78079158147de21225113f9320c28468c8509b20c22461655d321`
- `lib/desktop/releaseMergeCredentialExposure.ts` SHA-256 `77f3ea89e7c188acd529691aa8c18bffd5df5363bb85ccf7098794e3a367b3fd`
- `lib/governance/intelligence/governedProviderMerge.ts` SHA-256 `eaa78b373b92cbb4966353846c77c1c5ee04b2a950c1807767a5ee01076572f1`
