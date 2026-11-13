# Same-attempt committed dispatch Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement tasks with independent review before final completion. Steps use checkbox syntax for tracking.

**Goal:** Enforce the owner's accepted authorization-at-commit boundary with a same-attempt, exact-bound, one-use postcommit deadline/currentness checkpoint before native resource effects.

**Architecture:** Existing locked authorization, current people/source checks and irreversible intent/child records stay unchanged. A private checkpoint seals the exact restriction already accepted inside that original authorization; only acknowledged completion can create it. A separate transport-owned clock-free callback checks the original runtime/source/credential/request bindings after commit, never the original transaction's authorization functions.

**Tech Stack:** Existing TypeScript, private WeakMaps, AbortSignal, Vitest and installed SDKs with intercepted I/O. No dependency/schema additions.

**Spec:** AUTHORIZATION-LINEARIZATION-DECISION.md; owner call_89f041fe45684b9595c09952d8f6fd6c approved recommended boundary and conditional local implementation.

## Global Constraints

- Local code and mocked/ordinary isolated tests only; no actual SQL/native clock/credentials/provider/account/resource/sign/install/deploy/enablement/spend.
- Never repeat the original owner callback after commit, renew a deadline/credential/approval, create another attempt, or undo a consumed/unknown record.
- Do not reuse the original transaction-bound final-facts wrapper as postcommit currentness. Missing explicit private dispatch currentness refuses; no fallback/default qualifier.
- Preserve the check-to-send scheduling race. Provider-enforced receipt deadlines are not established; no strict physical-send promise.
- ClockBound/native raw reader/arithmetic/adoption remains outside this code unit.
- No package-lock edits, pinned evidence changes, passing-suite duplicates or direct main push. One reviewed green PR only after complete aggregate verification.

## Review Focus

1. An owner calls time/facts but loses commit acknowledgement: no checkpoint/effect; original liability remains.
2. A tighter original human/source/JWT deadline is lost when a transport supplies its credential window: retain the exact original intersection.
3. A checkpoint is cloned, reused concurrently, phase-substituted or used with another request: refuse before the next native effect.
4. Time/currentness/cancellation changes after commit: refuse the next resource access, retain already committed history, no replacement.
5. Provider response is already known: later bookkeeping/reader failure must not erase confirmation or replay.

## Task1 — shared private checkpoint (root)

Files: lib/governance/platform/executionTime.ts; lib/governance/platform/__tests__/executionTime.test.ts.

Interfaces:
- Existing authorizeExecutionWindow signature/behavior remains for non-dispatch authorization. Extract a private core returning the exact frozen joined ExecutionTimeWindow only on fully completed owner/final-facts acknowledgement.
- Export type ExecutionDispatchCheckpoint (opaque branded object).
- Export prepareExecutionDispatch(source:ExecutionTimeSource,window:ExecutionTimeWindow,authorize:ExecutionTimeAuthorization,signal:AbortSignal,binding:object,assertDispatchCurrent:()=>Promise<void>,requiredFinalFacts?:()=>Promise<void>):Promise<ExecutionDispatchCheckpoint>.
- Export consumeExecutionDispatch(checkpoint:ExecutionDispatchCheckpoint,binding:object):Promise<void>.
- Instance-private WeakMap records exact immutable joined window, source/signal, binding object identity and separate callback; token exposes nothing and cannot come from JSON. Captured callbacks/source references must not be swapped later. Binding is a frozen private phase/request object, not a secret-bearing serialized record. Preparation rejects nonobject or unfrozen bindings. Any request/body digest is private ephemeral only, never persisted, returned or logged; prefer existing immutable artifact/effect/captured-value identity for secret settings.
- Preparation runs the unchanged original check/final facts exactly once and creates the checkpoint ONLY after acknowledged owner completion. Consumption deletes/marks consumed before any await, verifies exact binding identity/original signal, reads the captured clock against the SAME joined window and verifies original dispatch facts after that await. No original owner or transaction use after commit. Callback failure, expiry equality, canceled or malformed time permanently refuse. This is best-effort dispatch validation under the accepted semantics, not proof against scheduling pauses.

- [ ] Write failing tests for delayed commit crossing narrowed deadline, mutation of supplied restrictions, lost acknowledgement, pending/missing native callbacks, clone/substitute/reuse/concurrent consumption and postclock currentness/cancellation.
- [ ] Run only this file and record expected RED assertions before implementation.
- [ ] Implement the small shared primitive, preserve original guard retirement and failed-promise handling.
- [ ] Run focused checks, then make shared interface available to three lanes. Do not broaden testing until lanes finish.

## Task2 — original ECS source/role/send phases (laneA)

Files: operations/nativeCustodianSupplier.ts; operations/privateStsIssuer.ts; operations/ecsSdkTransport.ts; operations/ecsExecution.ts if an explicit native dispatch-facts port is needed; corresponding source/STS/SDK/joined tests.

Order: source.acquire original intent commits, then original beforeSourceRead authorization acknowledges, checkpoint consumed immediately before readNativeCustodianResponse. role.acquire original beforeIssue transaction commits, checkpoint before bounded STS handle. ecs.send original beforeSend transaction commits, checkpoint before bounded ECS handle. No original intent assertion/timelyWorkload after commit.

Source currentness uses SAME frozen capture + assertCurrentFacts. STS uses SAME captured primitive credential/request + assertCustodianFactsCurrent. ECS needs an EXPLICIT transport-owned clock-free native currentness function; the tx-bound assertQualified is NOT a fallback. Fixed phases, original request/target and credential identity must be sealed before preparation. Describe/read phases have distinct phase binding and original reader authority, not a reused write checkpoint.

- [ ] Reproduce expiry/cancel/native revocation AFTER original acknowledgement with zero credential/STS/ECS requests; prove unknown attempt retained in composed intercepted fixtures.
- [ ] Wire shared checkpoint at each actual native boundary and preserve maxAttempts1/result/credential liability semantics.
- [ ] Run only changed focused files. Report no actual SQL/native/provider qualification.

## Task3 — deployment and create-only settings (laneB)

Files: deploymentNativeTransport.ts; operations/settingsVercelTransport.ts; existing native/joined tests. Do not change original actionStore/settingsExecution transaction semantics unless required by reproduced propagation failure.

Existing local authorize wrappers must produce a checkpoint from the SAME owner/check/final-facts path and exact narrowed window. Keep original local completion guards. Separate checkpoint phases for held credential copy and deployment/create POST. Seal frozen effect/binding, target/generation/artifact/profile, exact body digest (never secret body/token), same held credential reference and source window. Add explicit dispatch-currentness ports where existing qualifiers are tx-bound/timed/ambiguous; no permissive fallback.

- [ ] RED postcommit expiry/currentness/cancel between credential or send acknowledgement and effect; assert no next copy/POST, no replay and original reservation held.
- [ ] Consume immediately before fixed readCredential/readHeldCredential/fetch with no original owner reauthorization.
- [ ] Preserve create-only type/visibility mapping, target reservation, response and unknown semantics; run changed focused tests.

## Task4 — growth/image/template phases (laneC)

Files: growthNativeTransport.ts; imageNativeTransport.ts; templateNativeTransport.ts; native/joined/final-send tests; store composition files ONLY for explicit dispatch-facts plumbing. Original claim/hold/reservation proofs stay independent.

Growth: separate selected-row read, pre-decrypt and final publish/delete phases. Existing repeated original-current checks are not automatic postcommit checkpoints. Image: original admit/current transactions acknowledge before credential access, initializerPOST, uploadPUT and readinessGET; consume inside within's actual callback after microtask. Template: original admission/current acknowledges before held-credential read; consume per distinct signed SDK phase inside NodeHttpHandler.handle AFTER async signing; separately guard presigner invocation and retain original grant hardexpiry/result validation. Do not treat all SDK commands as interchangeable. Existing provider qualification/source/custody gaps stay unavailable.

- [ ] RED postcommit expiry/revocation/cancellation per irreversible native phase and request/checkpoint substitution; assert zero next effect and retained original history.
- [ ] Implement explicit native dispatch-currentness plumbing without original tx reuse. No new credential or generalized provider permit.
- [ ] Run changed focused files and report exact remaining phase gaps; don't silently label partial coverage complete.

## Task5 — aggregate review, docs and validation (root)

- [ ] Independently review plan before any code; cross-review lane diffs after focused GREEN and reproduce important findings before correction.
- [ ] Update existing internal demo wording and five current status docs in same source batch, backing up and preserving historical evidence. State native sources/real human/provider/physical-receipt/other-master gaps accurately.
- [ ] Run root strict types and one coherent full ordinary suite after all changes, plus relevant composed intercepted tests. Any actual SQL/production build needs fresh exact authority; do not reuse consumed grants.
- [ ] One exact frozen-source green PR checkpoint only after required checks. No production enablement/deployment implied.

## Independent plan review
/root/handoff_design_review found no important blocker/signature contradiction and approved implementation under the existing conditional local grant, with the frozen-binding and private ephemeral digest clarifications now incorporated. No code/native execution or external effects occurred in review.
