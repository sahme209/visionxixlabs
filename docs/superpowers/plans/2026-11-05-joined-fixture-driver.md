# Joined Fixture Driver and Private Coverage Implementation Plan

> **For agentic workers:** Use the reviewed spec, focused test-first implementation and task/whole-unit review. The user explicitly selected a persistent four-person team: root plus two backend specialists, and one visual specialist. Preserve those roles; coordinate disjoint files instead of spawning extra workers.

**Goal:** Connect fixture authentication, the real private consumer and enrolled admission without substituting test guards or production credentials.

**Architecture:** A fixed producer issues only opaque fixture credentials over a private bounded frame. The existing controller reaches the same six-operation listener while retaining its startup connection; canonical-only scenario code uses actual writers between bounded jobs. Private registered coverage is shared by activation and execution, and an immutable source-owned simulator replaces only remote provider responses.

**Tech Stack:** Existing TypeScript/private Prisma interfaces, C/Objective-C source, Vitest and pure/fully mocked native tests. No new dependency.

**Spec:** `docs/recovery/2026-11-05/governance-fixture-driver-design.md`, independently reviewed at SHA256 `bd27c792e175146a026930a459260b93fc72028661dd49098a46240534602278`.

## Global Constraints

- User approval `call_mMqfhxv3T8NfxA9xrWEBvzBI`: source, compilation and pure/mocked tests only. No actual SQL/cluster/schema/transaction, credential/resource access, native/helper/controller launch, service, signing, installation, provider call, deployment or spending.
- Frame is `AXQAUTH1` (8 bytes), fixed32ASCII generation, uint32BE payload length at offset40; header44bytes, payload at most65536bytes. Strict JSON has exactly tenant/requesterToken/reviewerToken/scenarios, at most64 declared cases. No stdout/env/argv/file token delivery.
- Each descriptor has exactly caseId/requestId/planId/expectedVersion/clientRequestId. Versions0–2; request IDs use existing160-character data-adapter grammar, plan ID is `release_plan_` plus64lowercasehex, nonce is UUID. The ten source-ordered case IDs are read_execution, prepare_enrolled, execute_enrolled, cancel_prepared, read_operation, execute_unknown, recover_unknown, revoke_before_claim, revoke_after_await, revoke_before_send. Unknown, duplicate or reordered cases refuse.
- Tenant/actors/sessions are the existing fixed qualification workspace/requester/reviewer. No real customer/Fatima identity is used. Scenario decisions are explicitly SIMULATED REVIEW AUTHORITY.
- Retain the original six-operation namespace,4096-byte request envelope,1024/256-byte nested bodies,262144-byte responses, deadlines, cancellation, durable attempts and unknown/no-replay semantics.
- F0 producer creates base identity/session/billing and deterministic source inputs only. F1 canonical setup runs after actual current origin/material initialization before business-ready. F3 follows real handler drain but precedes native completion while original request/currentness remains live.
- Drain phase stdout and private fd3 concurrently under the existing deadline. Quarantine credentials until complete phase2, normal owned reap, exact EOFs and successful item/locator provisioning. Unknown emits no credentials.
- Coverage binds actual mounted factory closures/private captures at construction; per-attempt objects bind later before claim/exposure/send. Never pre-mint a credential for registration, seed an active pointer, inject a fake guard or return verifyCoverage=>true.
- Keep global/unregistered coverage unavailable; private coverage supports only repository.merge from stored release/plan scope. Current identity is not fleet qualification or an action grant.
- Normal scenario writers cannot overlap unsettled handlers; declared revocation barriers are explicit exceptions. A known provider-UNKNOWN may advance only same-operation observation/recovery; native/transport uncertainty stops. Never restore a revoked session/membership or reset consumed work.

## Review Focus

1. Full64KiB or fragmented authorization output cannot deadlock behind phase/reap waiting; partial/extra/failed output must never escape quarantine (Task1).
2. Valid-looking credentials/plan hashes cannot replace actual current session, role, tenant, source or history checks; no backend key enters the frame/log (Task2).
3. Activation before a per-attempt object exists cannot be solved by prefetching a token or accepting a DTO; exact factory registration and later attempt binding must share one reader (Task3).
4. Prepare cancellation/drain races cannot create a late synthetic approval merely because the origin remains alive (Task4).
5. The simulator cannot fall back to fetch, and source/mock results cannot be called actual native/SQL/provider or genuine-review acceptance (Task5).

## Task 1 — Native frame, private handoff and retained caller

**Owner:** owner_binding. Create `native/fixture_authorization_frame.c/.h` and pure/mock tests under `packages/verified-issuer-runtime/`; modify native `synthetic_fixture_producer.c`, its mocked test, `scripts/governance_local_issuer/origin_control.m` and exact preparation source closure.

**Interfaces:** consume the Task2 encoder's exact frame. Provide a bounded parser/state record with no I/O, and fixed source wiring that concurrently collects stdout/fd3, owns/reaps the helper and delivers once to the confirmed-owned controller. Preserve existing phase protocol and controller/native request types.

- [ ] Write/run failing pure cases for wrong generation, malformed/excess length, extra/duplicate JSON keys/cases, bad token/plan/nonce fields, fragmentation and incomplete EOF.
- [ ] Implement parser and source handoff; keep all real platform calls behind fully substituted test functions.
- [ ] Write/run failing fake-platform cases for64KiB pipe pressure, interleaved phase/HBA ACK, failed/unknown reap, cancellation and zero delivery before provisioning commits; implement then verify GREEN.
- [ ] Add controller six-op source/retained-connection logic and fake ownership/lifetime tests; compile operational objects only and leave them nonexecutable/unrun.
- [ ] Record commands, source hashes, test scope and task review; root commits after integration.

## Task 2 — TypeScript frame, actual authentication and fixed scenario/provider program

**Owner:** system_assembler. Create `fixtureAuthorizationFrame.ts`, `privateFixtureAuthentication.ts`, `privateFixtureScenario.ts`, `privateFixtureProvider.ts` under `lib/governance/qualification/`, with focused `__tests__` files. Modify `privateSyntheticFixtureProducer.ts`, private bootstrap/composition and only required existing private writer cores; coordinate the latter with root before editing.

**Interfaces:** `encodeFixtureAuthorizationFrame(value):Uint8Array` / `decodeFixtureAuthorizationFrame(bytes):FixtureAuthorization`; exported internal `FIXTURE_SCENARIO_IDS` and descriptor type use the global exact fields. Authentication uses the real private codec/session/resolver, returning only the frame. `createPrivateFixtureScenario(capturedResources)` produces a lexical initialize(signal)/afterSettled(ownedCase,signal) object; package lifetime still exposes only dispatch/close. Provider constructor returns a fixed fetch-compatible function with no network fallback.

- [ ] Run RED codec cases against refusing stubs; implement strict bounded encoding/decoding and cross-language fixtures matching Task1.
- [ ] Test real codec/resolver composition with mocked database observations for exact fixed rows, wrong tenant/key/API key, expiry/revocation/commercial refusal and secret-free diagnostics; implement no always-true authority shortcut.
- [ ] Test fixed provider allowlist/method/body/credential-scope matching, one-write counters, late/lost responses and unmatched-request refusal before implementing its finite automaton.
- [ ] Reuse actual plan/review/baseline/policy/approval constructors and explicit-instance writers for F0/F1/F3. Test required histories and typed scope bindings with mocked transactions, preserving simulated-review classification.
- [ ] Test monotonic case transitions, no replay/remint, and policy/connection faults isolated to distinct planned scopes; terminal session revocation remains terminal.
- [ ] Record task review/results; do not claim actual PostgreSQL atomicity or native acceptance.

## Task 3 — Private registered coverage shared by activation and execution

**Owner:** root. Create `lib/governance/intelligence/privateMergeExecutionCoverage.ts` and tests; modify `requestServiceCore.ts`, `privateGovernanceMergeRequestService.ts` and narrowly required coordinator dependency/binding seams. The assembler owns `privateReleaseMergeComposition.ts`; communicate API additions before editing it.

**Interfaces:** internal `createPrivateMergeExecutionCoverage(repo,capturedAuthority,registeredPrivateGraph)` with direct import of actual canonical identity. Capture actual private session resolver, clock and graph factories/configuration, not request DTOs. Produce request-bound `readCoverage(selection,signal,tx?)` and `verifyBaselineActivation(tx,scope,baseline)`, plus a per-attempt binding/currentness check. Derive scope by parsing actual stored plan/release and current connection; request ID/plan ID come from the validated six-op route and are rechecked against storage. Optional service coverage port is absent in global/default composition and must be recognized as an actual private registration, not an arbitrary boolean callback.

- [ ] Write/run RED tests for registered positive scope, absent/mismatched factories/repo/auth/transport/current origin, stale source, wrong scope/action/tenant and revoked authority.
- [ ] Implement one private registration reader and reuse actual release/plan/source authority contracts; validate registration again after awaited work. No provider/network I/O inside the locked registration check.
- [ ] Add optional recognized private coverage to revision-store verification, readExecutionCoverage and guarded baseline activate(id,parent,nonce); preserve default unavailable behavior and current evidence/preflight/roles/independent review/CAS.
- [ ] Bind actual per-attempt guard/credential/transport construction back to the same registration before claim, credential exposure and final intent. Preserve existing default V2 executor.
- [ ] Test service activation/read/guard using the actual coverage code and mocked transactions/native facts, not seeded pointers or verifyCoverage=>true. Record limitations and review.

## Task 4 — Joined canonical lifecycle and source inventory

**Owners:** assembler bootstrap/scenario, owner native, root integration.

- [ ] Wire F0 producer's fixed auth frame without changing phase stdout, then F1 canonical initialize before readiness.
- [ ] Wire F3 only after true pending-handler drain and before dispatch resolves/native completion; test aborted/expired/lost-origin response cannot issue a decision or advance a case.
- [ ] Join exact controller descriptors, helper hashes, source closure and fixed synthetic bootstrap/provider selection; no environment/URL/body fixture switch or arbitrary callback.
- [ ] Exercise actual six-op dispatcher→private graph→real registered coverage/guard/store code with simulated native/storage/provider observations. Required positive is enrolled; unenrolled compatibility cannot replace it.
- [ ] Preserve older tests/receipts and original operational matrix. Save exact remaining actual artifact/SQL/System/custody/fleet/human gates.

## Task 5 — Closing verification and recovery

- [ ] Cross-review native and TypeScript work, then whole-unit source review; reproduce important findings with focused RED→GREEN tests.
- [ ] Run only affected pure/mock tests, scoped types and compile-only checks; inspect every result. No wildcard suite that spawns real runtime/helper/SQL targets.
- [ ] Verify all source/API/frame/inventory joins, update numbered board without changing the user's master additions, commit owned files and verify one incremental local bundle.
- [ ] Leave Governance/full21 scope active and incomplete until actual required operational/customer evidence exists. Visual work remains the separate one-agent lane; previews are now milestone-based at the user's request.

## Rulings and execution ledger

- Ruling: retain existing specialized workers and parallelize only disjoint owned files, rather than spawning fresh agents per task. The user explicitly requested three backend workers plus one visual worker; uncoordinated shared edits would cost rework.
- Ruling: pure/mock approval does not authorize any actual isolated PostgreSQL run. Prepare those tests but defer actual SQL to an exact later decision; claiming mock atomicity would misrepresent completion.
- Initial state: reviewed design approved; Task2 codec RED observed before implementation. All implementation/acceptance checkboxes remain open.
