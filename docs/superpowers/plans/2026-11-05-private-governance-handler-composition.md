# Private Governance Handler Composition Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans after the pending design approval is received. No implementation is authorized by this plan alone.

**Goal:** Reuse the real execution/history HTTP validation and actual private coordinator through a bounded data adapter without shared-resource fallback.

**Architecture:** Extract construction-injected handler cores from the existing modules. Keep legacy wrappers unchanged at their public signatures; compose private handlers inside the existing lexical private graph. Prepare but do not mount the six-operation data adapter.

**Tech Stack:** Existing TypeScript, NextRequest/NextResponse, Zod, Vitest and private Prisma interfaces; no new dependency.

**Spec:** docs/recovery/2026-11-05/governance-private-handler-composition-proposal.md

## Global constraints

- Local source/pure/mocked scope only until explicit pending approval arrives; real isolated database tests additionally require their existing explicit grant.
- No listener, service, canonical startup/public runtime export, feature enablement, positive issuer, native/Keychain/resource operation, real provider/credential, deployment or spending.
- Keep six operations, all current HTTP validation/deadline/rate/error/unknown semantics and genuine independent decisions.
- Current bootstrap remains close-only and canonical issuance unavailable. Exposing an internal composition instance for source tests is not a public runtime business channel.
- No edits to master user additions, accepted signed artifacts or consumed histories.

## Review focus

1. Importing a core must not initialize global database/session/auth resources.
2. History/recovery must not gain coordinator/credential/provider dependencies.
3. Caller fields must not select identity, tenant, dependencies, transport, URLs or qualification.
4. A cancelled, expired, revoked or UNKNOWN action cannot gain another claim/send.
5. Legacy wrappers and private handlers must agree on exact versions, body/response limits and operation bindings.

## File and interface map

- New `lib/desktop/releaseProviderMergeExecutionHttpCore.ts`: `createReleaseProviderMergeExecutionHttp(dependencies)` returns `(request: NextRequest, requestId: string, planId: string) => Promise<Response>`. Dependencies are trusted construction values: private-compatible repository, current session resolver, rate limiter and coordinator factory. Derive their types from actual existing signatures, not permissive `any`.
- New `lib/desktop/releaseProviderMergeOperationHttpCore.ts`: matching `createReleaseProviderMergeOperationHttp(dependencies)` with repository/current resolver/rate limiter only; no coordinator.
- Existing `releaseProviderMergeExecutionHttp.ts` and `releaseProviderMergeOperationHttp.ts`: import global dependencies only here; retain current exported names/signatures and execution `ports` parameter.
- Existing `privateReleaseMergeComposition.ts`: retain `forRequest`, add internally composed `handleExecution`/`handleOperation`; capture existing client/resolver/private coordinator and shared pure rate limiter only. No returned secret or private adapter.
- New `lib/desktop/privateReleaseMergeRequestData.ts`: pure strict decoder/mapper and `createPrivateReleaseMergeDataDispatcher(handlers)` for trusted internal construction, not runtime export. Consumes existing six-op envelope; creates fixed NextRequest, serializes bounded Response, propagates AbortSignal. No listener or production entry import.
- New focused tests beside existing HTTP/private composition tests and a data-adapter test. Update current exact-key composition assertion deliberately to the new internal composition surface; canonical bootstrap/public exports remain unchanged.

## Task 1 — same handler cores, legacy-equivalent behavior

- [ ] Add RED core-construction/import tests: make legacy `lib/db`, global session resolver and legacy coordinator throw on import; import/use cores with owned mocks successfully. Check GET/POST/schema/version/plan/tenant/expiry/error outputs against existing handler cases.
- [ ] Run only new targeted tests and observe the expected missing-module/export failure.
- [ ] Move existing handler bodies to the two dependency-injected core factories. Preserve `expectedVersion===0`, operation derivation, source binding, body1024/256, deadlines25000/10000, rate capacity8/refill0.1 and15/refill0.3, private/no-store headers and existing mutation/read permissions. No "cleanup" behavioral changes.
- [ ] Compose unchanged wrappers; run existing two HTTP suites plus the new core tests via `node scripts/run-vitest.mjs <exact test paths>` and inspect actual totals. Do not rerun unrelated suites.
- [ ] Independent diff review of extraction/dependency equivalence, then scoped commit.

## Task 2 — actual private instance composition

- [ ] Add RED tests to existing private composition suite: private handler uses the supplied private client and signed synthetic token, refuses API keys, wrong tenant and revoked membership/session; global resources throw if touched. Confirm history/recovery never calls App config or transport.
- [ ] Construct private handlers with captured private resolver/client/coordinator factory. Preserve every core authority check; do not replace the coordinator with an easier executor.
- [ ] Test attempted execution still refuses at canonical issuer before transaction/credential/provider effect, even with both private feature readers true in the existing simulated fixture. No injected digest or newly positive capability.
- [ ] Run only task2 and directly affected task1 tests plus scoped types; independently review resource closure and changed internal instance surface. No database/native acceptance inferred.
- [ ] Commit the coherent composition changes.

## Task 3 — strict unmounted data adapter

- [ ] Add RED tests for exact six-op mapping, UTF-8 envelope4096-byte cap, nested body1024/256, exact field/type/operation validation, no CR/LF authorization header, denied query/URL/actor/org/transport/readiness fields, cancellation and response262144-byte cap. Use bounded byte input; reject duplicate JSON keys with a strict decoder rather than relying on last-key-wins JSON.parse.
- [ ] Retain original envelope field names `protocol`, `operation`, `requestId`, `planId`, `authorization`, `body`. Protocol is `axiom.issuer-request/1`; operation comes from original six-value list. Read envelopes omit body; mutation body must match its original action/version/clientRequestId requirements. Rejected unknown keys must never reach a handler.
- [ ] Token source audit: normal sessions use `dsk_` +32hex (`privateDesktopSession.ts`), producing110-byte `axm.desk.<id>.<64hex>` credentials. Existing optional supplied session IDs lack a universal cap. Therefore enforce the already proposed whole-envelope4096-byte bound without silently promising all legacy/custom token shapes fit; do not change token mint/verification semantics or widen the envelope. Reject oversized credentials as unsupported input. Record that transport bound for explicit design review before implementation.
- [ ] Construct only fixed existing provider-execution/provider-operation paths at an internal non-network origin; forward Authorization and mutation Content-Type only. Derive identity in private handler; never forward caller scope/URL/headers. No fetch/network listener is used.
- [ ] Propagate cancellation into request signal; never retry/reconnect/dispatch after uncertain results. Serialize allowed existing response data within byte cap; no request/session value or raw exception in diagnostics.
- [ ] Run new adapter and directly affected composition suites, scoped types and independent review. Actual emitted closure compiler execution is a separate bounded operation to reconcile before running; do not trigger the full4GB package build.
- [ ] Update numbered execution evidence with exact source/test classes and remaining custody/channel/native/fleet gaps; commit only owned files and verify incremental local recovery. No push or production activation.

## Completion for this source unit

All three tasks require the pending local design decision, actual test outputs, dependency-closure review and preserved legacy behavior. Completion of this unit does not establish native ingress, operational identity, custody, fleet, live send or full A2/A9. Next actual work remains trusted synthetic material input and same-compiled-consumer qualification under their reviewed boundaries.

## Preparation review

Independent source-only review corrected the normal token length to110 ASCII bytes (9+36+1+64). No other important finding. This plan is prepared, not approved or executed; no new test, build, database or runtime acceptance is recorded.
