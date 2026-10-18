# NEW TEST Anniversary Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after root review. No subagents are authorized by this task. Steps use checkbox syntax.

**Goal:** Support full ordinary monthly/annual paid TEST service periods with monthly-anniversary included pools, preserving original Free attribution and purchased balances through late usage/settlement.

**Architecture:** Add versioned window and allocation-provenance kernels to the existing NEW TEST service/consumer. Use existing UsageEvent/AIUsageReservation/AddOnPurchase for money, with fixture-only immutable identity/bucket/hold-attribution sidecars because reservations have no JSON field. Every preview/admission/usage settlement uses the same provenance and DB-time/revision fences; V1/legacy/support remain unchanged.

**Tech Stack:** TypeScript closed unions, installed Stripe20 types, Prisma existing ledger, PostgreSQL17 owned DDL, Vitest and actual local Next fixtures.

**Spec:** `docs/superpowers/specs/2026-10-18-new-test-anniversary-allocation.md` (owner policy plus exact proposed storage/race contract; root review required before code).

## Global Constraints

- Base1cd5bc23, isolated worktree only. No changes to published billing worktree.
- NEW TEST anniversary windows/no rollover; full paid pool at Free→paid; previous Free usage/holds keep original bucket; purchased remaining balance and original expiry preserved.
- No v1 reinterpretation, duplicate financial ledger, production model/migration/route/IO permit, provider call, shared install/generation, legacy/support changes or deployment.
- Same original create/collection/identity/term guards, event consumer, immutable evidence and dual coverage/plan fences. New enrollment fence supplements them.
- Implementation and focused light tests only after root approval. Full compiler/default suite/ownedPG/Next/desktop require coordinator windows and independent review first. Plan preparation deliberately did not run/install baseline dependencies under the root's light-only restriction.
- Updated Pricing & Usage demo/docs accompany implementation; public catalog amounts remain unchanged. Actual hosted payment/routes/storage/proxy acceptance remains separate.

## Review Focus

1. Free admission commits before paid activation but its cost arrives later: original Free/purchase allocation survives and full new paid included pool is not reduced.
2. Every V2 ledger debit/hold is classified: missing/foreign/unattributed usage denies, never becomes zero balance or a guessed bucket.
3. Jan31/Feb29 anchored anniversary restoration and12annual windows use exact UTC half-open bounds, with no extra pool at calendar rollover or replacement invoice.
4. Purchased credit consumed/reserved in a prior bucket stays consumed/reserved after transition/renewal/refund; no balance is recalculated as full delivered credit.
5. Late provider records/replays/concurrent negative coverage cannot mint authority or rewrite completed allocation; all money stays in existing rows.

## File map and shared interfaces

Create `lib/billing/newTestSubscription/anniversaryWindow.ts` (pure UTC F(n), versioned basis/window), `allocationV2.ts` (closed attribution/funding/read arithmetic), `fixtureAllocation.ts` (owned DDL/marker/locking/validation), `usageAllocationIO.ts` (existing-ledger atomic V2 attach/settlement). Tests colocate under `lib/billing/__tests__` with focused fixtures and the existing owned PG suite.

Modify `paidCoverage.ts`, `stripePaidCoverage.ts`, `stripeTestProvider.ts`, `service.ts`, `fixtureCoverage.ts`, `verifiedContract.ts`, `paidPlan.ts`, `postgresFixtureStore.ts`, `isolatedApplication/plan.ts`, `currentAIAllowance.ts`, `aiCreditReservation.ts`, `recordAIUsageEvent.ts`, `reconcileGatewayUsage.ts`, and the existing `app/api/ai/generate/route.ts` internal accounting composition only. V2 branches require authoritative enrollment/provenance; no external request selects them. Old functions retain exact legacy behavior when V2 is absent. Do not instrument unrelated denied workflows to simulate provider acceptance.

Shared names:

- `AllowanceBasisV2`: exact policy/scope/enrollment/basis digest and original provider anchor; Free/paid discriminated variants per spec.
- `resolveAllowanceWindowV2(basis, coverage, now): {kind:'available',window:AllowanceWindowV2}|{kind:'unavailable',reason}`; window `{bucketId,basisDigest,kind,start,end,includedCents}`.
- `ReservationAttributionV2`: immutable spec body; reservationId is the existing hold ID, no new hold identity.
- `resolveAllocationV2(window, verifiedUsage, verifiedHolds, eligiblePurchases): available balances and reserve funding plan | unavailable`.
- `recordAttributedUsageV2(tx, reservationId, trustedProviderUsage): existing UsageEvent/result`; `settleAttributedUsageV2(tx, reservationId, eventId, authoritativeCost): settled|already_settled|unavailable`. Inputs are server-selected original admission references; generic metadata cannot supply authority.

## Task1: Versioned basis and exact windows

**Files:** create anniversaryWindow.ts; extend paidCoverage.ts discriminated V2 while leaving V1 bytes/hash unchanged; tests anniversaryWindow.test.ts and existing newTestPaidCoverage.test.ts.

- [ ] Write RED table tests for Oct18, UTCtime, Jan31Feb28Mar31, leap Jan31Feb29Mar31, annual Feb29→Feb28 and exactly12 subwindows; first full pool3000 after Free200 spent; Nov1 no reset; exact end denies; missing next proof/no current collection denies.
- [ ] Run only these cases and observe failure against calendar-only kernel.
- [ ] Implement direct original-anchor F(n), closed canonical bucket identity and version dispatch. No arithmetic-loop rollover or interval guessing; old V1 accepts exactly its old calendar slice and rejects reinterpretation.
- [ ] GREEN tests plus existing V1 evidence digest regression; commit kernel+matching spec clarification only.

## Task2: Frozen original anchor and fixture-only basis/attribution storage

**Files:** fixtureAllocation.ts; service.ts/stripeTestProvider.ts/stripePaidCoverage.ts/fixtureCoverage.ts/verifiedContract.ts; fixtures/tests newTestAllocationStore.test.ts and existing original/lifecycle suites.

- [ ] RED: missing enrollment, policy drift, V1-upgrade attempt, wrong anchor/start/line/term/account/org, partial initial period, unknown old usage/hold, modified attribution/FK/scope, duplicate reservation/event linkage, failed initial transition rollback.
- [ ] Observe RED. Implement spec's three owned tables, immutability/check/FK guards, known-new enrollment and policy metadata at intent preparation. Do not add Prisma fields/migrations or overload correlationId. Validate full existing fact sets; bounds exceeded denies.
- [ ] Initial paid basis derives from current verified original full invoice/subscription anchor and original immutable attempt; bind with existing consumer transaction and increment enrollment revision atomically. Existing independent coverage revision remains mandatory. New V2 evidence schema never changes V1 digest.
- [ ] GREEN focused SDK mocked-remote/DDL contract tests; prove no extra unbounded provider reads and unchanged hard deadlines/default IO denial; commit.

## Task3: Shared allocation arithmetic and actual preview/admission

**Files:** allocationV2.ts, paidPlan.ts, postgresFixtureStore.ts, isolatedApplication/plan.ts, currentAIAllowance.ts, aiCreditReservation.ts; tests allocationV2.test.ts and current/admission legacy regressions.

- [ ] RED: included bucket balances; purchase500→Free debit80 leaves420 across paid start; active purchase hold100 leaves400 globally; current_month expiry unchanged; permanent credit not reissued at anniversary; unknown/foreign attribution denies; negative refund balance denies new spending.
- [ ] Observe RED. Implement included-first then existing-expiry/createdAt/id purchase allocation, using existing net delivered/reversed rows and attributed billed/held amounts across all buckets. Never sum full delivered credit as a new balance each period.
- [ ] Replace only V2 preview/app/reserve aggregates with shared exact bucket/purchase arithmetic. Enrolled pre-contract Free derives200 from public policy; V1 missing provenance still denies, and legacy/no-enrollment path stays identical.
- [ ] Final insert uses enrollment lock/revision + existing coverage/plan token/revision + DBclock inside bucket/coverage, inserting existing hold and immutable attribution atomically. Old preflight after paid transition/window end fails; no hold is transferred/reset. Historical request replay does not dispatch.
- [ ] GREEN arithmetic/IO/legacy regressions; commit.

## Task4: Atomic existing usage linkage and late settlement

**Files:** usageAllocationIO.ts, recordAIUsageEvent.ts, aiCreditReservation.ts, app/api/ai/generate/route.ts, reconcileGatewayUsage.ts; tests newTestUsageAllocation.test.ts and existing Gateway/usage tests.

- [ ] RED mandatory race: Free100 hold→paid bind→actual80 settles; event metadata points original Free bucket, paid included3000 untouched. Variant Free included exhausted and purchase500 funding100→actual80 leaves420 purchased plus3000 paid. Test cross-window and paid→inactive late costs too.
- [ ] RED missing/foreign reservation, forged metadata namespace, wrong externalUsageId org, duplicate direct/Gateway usage, excessive billed amount, attribution mismatch, pending→settled replay and transaction failure between usage write and hold status.
- [ ] Observe RED. V2 direct event creation/attachment/settlement is one tx; Gateway pending event links original attribution before asynchronous reconciliation. Preserve unrelated metadata and externalUsageId/usageEventId identities; customer debit<=reserved source ceilings. The fixture-only DB guards seal completed metadata and amounts.
- [ ] Usage linkage always selects original reservation provenance, never current paid plan/time. On uncertain commit preserve unresolved financial hold; no optimistic release/regrant. Unknown writer without a trusted reservation refuses V2 accounting/admission. Old legacy writer/reconciler semantics are untouched.
- [ ] Factor the actual existing settlement IO for injected synthetic cost fixtures without removing `denyIsolatedUnsupportedOperation` or enabling real Gateway calls/cron. All existing other isolated routes stay denied.
- [ ] GREEN direct/Gateway cost/cap/refund/conservation and legacy regressions; commit.

## Task5: Reviewed owned evidence and final docs

**Files:** existing newTestSubscriptionService.postgres.test.ts plus new owned attribution cases; Pricing & Usage demo and spec/plan/execution receipt.

- [ ] Add RED acceptance fixtures before fix: concurrent Free-admission vs paid consumer barrier, actual SQL bucket/coverage expiry fence, pending old hold late settled to old bucket, purchase conservation, unknown ledger refusal, immutable V1/V2 coexistence, monthly renewal and12annual boundaries, rollback at each joined write.
- [ ] Complete light focused tests first; freeze source and obtain independent financial/provenance review. Root reviews interface/scope changes; no authority implied by a valid JSON shape.
- [ ] Under exclusive grant only: fresh whole-web types on root-only graph, then owned loopback PG17/actual Next8+new cases with synthetic provider replies and absolute denial, then full regression/desktop/Python as coordinated. No shared generation, provider IO or local website production build trial.
- [ ] Record exact source/hash/count/cleanup receipt, separately label pure boundary tests vs actual runtime checks and hosted gates. Update living docs/demo in same feature commit. Parent owns canonical tracking, push, CI/PR/merge and release approval.

## Consolidated RED matrix (required assertions)

| Trigger | Required result |
|---|---|
| Oct18 monthly or yearly full cash line, original matching anchor | First paid3000; annual only12monthly3000 windows. |
| Calendar Nov1 inside Oct18–Nov18 | Same bucket, same used/held values; no included refill. |
| Window exact end, latest invoice open/future/refunded/disputed | Unavailable, no new hold; historical balances unchanged. |
| Jan31/Feb29 and leap annual renewal | Direct anchor-clamped boundaries restore original day; exact12 windows, no13th grant. |
| Free200 consumed then paid starts | Full paid3000; Free usage remains Free bucket. |
| Freehold100 before start; actual80 after start | Old Free included80; paid3000 untouched; no settlement-time reclassification. |
| Purchase500 reserved100 in Free; actual80 after paid start | Purchase remaining420 globally; paid3000; no top-up regrant. |
| Free preflight rev0 loses paid transition rev1 | Final reservation denied, no partial hold/attribution. |
| Free reserve wins first, paid bind waits | Both succeed in order; old reservation immutable original basis. |
| Pending linked/unknown hold crosses boundary | Retained in original funding; purchase portion continues globally. |
| Old idempotency request after transition | Historical progress only; no new hold/provider dispatch/bucket. |
| Unattributed AI event/hold (even zero/pending), V1 proof upgrade | Unavailable; no inference/backfill/reset. |
| Scope, source ceilings, purchase ID or reserved metadata forged | Deny before mutation; no wrong-org read/debit/grant. |
| Direct/Gateway duplicate external event, attachment/settlement failure | Atomic rollback or exact historical result; no orphan/double debit/released unknown hold. |
| Refund after prior purchase consumption | Original usage stays; available floors0; no new spend from rewritten credit. |
| Annual replacement invoice/same-window recovery | Same bucket identity and usage; new collection proof cannot refill included pool. |
| Concurrent negative coverage vs stale positive | Existing dual-CAS preserved plus enrollment fence; no stale permission restoration. |
| Legacy/support or V1 calendar fixtures | Existing behavior and original evidence digests unchanged. |

## Self-review and handoff

Each owner policy is covered by tasks1/3/4 and the matrix. Review-focus classes map to tasks4/2/1/3/4. Interfaces above are single-source names; IO gets complete validated financial sets or Unavailable. Main concrete review decision is the fixture-only immutable reservation-attribution sidecar: current schema has no reservation JSON field, so pretending metadata already exists or deriving a late bucket from createdAt is invalid. This document proposes that exact interface without implementing it.

Plan-only branch has no dependency installation/baseline runtime under light-only scheduling. Root review is the next step; the owner's economic policy is already accepted and is not being reopened.
