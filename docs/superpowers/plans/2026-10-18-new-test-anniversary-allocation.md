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
- `ReservationAttributionV2`: immutable spec body; reservationId is the existing hold ID, no new hold identity. A separate write-once releaseEvidence column retains definitive non-use proof; allocation body never mutates.
- `claimNewTestBillableDispatch(tx,reservationId): claimed|unavailable` CASes existing reserved→dispatch_unknown before any billable call; `releaseNewTestUnusedDispatch(tx,reservationId,DefinitiveUnusedVerdict)` is the only validated post-claim release path. These are Task4 interfaces, not Task1 code.
- `resolveAllocationV2(window, verifiedUsage, verifiedHolds, eligiblePurchases): available balances and reserve funding plan | unavailable`.
- `recordAttributedUsageV2(tx, reservationId, trustedProviderUsage): existing UsageEvent/result`; `settleAttributedUsageV2(tx, reservationId, eventId, authoritativeCost): settled|already_settled|unavailable`. Inputs are server-selected original admission references; generic metadata cannot supply authority.

## Task1: Versioned basis and exact windows

**Files:** create anniversaryWindow.ts; leave paidCoverage.ts implementation unchanged; add fixed V1 digest/mid-month regression; tests anniversaryWindow.test.ts and existing newTestPaidCoverage.test.ts.

- [ ] Write RED table tests for Oct18, UTCtime, Jan31Feb28Mar31, leap Jan31Feb29Mar31, annual Feb29→Feb28 and exactly12 subwindows; first full pool3000 after Free200 spent; Nov1 no reset; exact end denies; missing next proof/no current collection denies.
- [ ] Run only these cases and observe failure against calendar-only kernel.
- [ ] Implement detached direct original-anchor F(n) and closed canonical basis/bucket identities; frozen original subscription/create/first-collection provenance stays in the basis, replacement invoice identity does not enter the current bucket. No arithmetic-loop rollover or interval guessing; old V1 accepts exactly its old calendar slice and rejects reinterpretation.
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
- [ ] Final insert uses enrollment lock/revision + existing coverage/plan token/revision + selected actual purchase FOR UPDATE locks/current fingerprint/global balance + post-lock DBclock inside bucket/coverage AND original purchase UTC validity, inserting existing hold and immutable attribution atomically. Existing refund UPDATE conflicts with the same purchase row lock; no assumption that reversal takes enrollment lock. Old preflight after paid transition/window end fails; no hold is transferred/reset. Historical request replay does not dispatch.
- [ ] GREEN arithmetic/IO/legacy regressions; commit.

## Task4: Atomic existing usage linkage and late settlement

**Files:** usageAllocationIO.ts, recordAIUsageEvent.ts, aiCreditReservation.ts, app/api/ai/generate/route.ts, reconcileGatewayUsage.ts; tests newTestUsageAllocation.test.ts and existing Gateway/usage tests.

- [ ] RED mandatory race: Free100 hold→paid bind→actual80 settles; event metadata points original Free bucket, paid included3000 untouched. Variant Free included exhausted and purchase500 funding100→actual80 leaves420 purchased plus3000 paid. Test cross-window and paid→inactive late costs too.
- [ ] RED unlinked purchase hold after five-minute TTL/crash before attachment cannot regrant, generic failure cannot release after claim, late actual usage retains original bucket, and same-key retry cannot redispatch. RED Oct31→Nov1 after lock wait and independent refund before/after reserve/claim both conserve funding.
- [ ] RED missing/foreign reservation, forged metadata namespace, wrong externalUsageId org, duplicate direct/Gateway usage, excessive billed amount, attribution mismatch, pending→settled replay and transaction failure between usage write and hold status.
- [ ] Observe RED. First implement V2-only dispatch_unknown on the existing hold, durable committed CAS before billable work and counting unknown capacity without TTL/link requirements. Local provider-denial guard remains before claim; generic caught errors never prove unused. Write-once definitive-unused receipt plus CAS is the only post-claim release. Repeat selected-purchase/current-clock fence at claim, not only reserve. V2 direct event creation/attachment/settlement is one tx; Gateway pending event links original attribution before asynchronous reconciliation. Preserve unrelated metadata and externalUsageId/usageEventId identities; customer debit<=reserved source ceilings. The fixture-only DB guards seal completed metadata and amounts.
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
| Dispatch claim committed, crash/unlinked past5minutes, new admission | dispatch_unknown remains live without usage link; purchased ceiling remains spent/reserved, no TTL regrant. |
| Provider/usage/attach/settle generic error after claim | Unknown hold retained; no ordinary catch/release or timeout is unused proof. |
| Oct31 selected current_month purchase waits on lock untilNov1 | Final post-lock INSERT and dispatch CAS recheck DBmonth and refuse, although paid anniversary bucket is unchanged. |
| Existing refund UPDATE wins first or waits behind reserve/claim | Current row fingerprint/locks prevent stale net grant; both orders preserve committed hold/spend. |
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


## Review amendments and Task1 execution record

Independent financial architecture review found two material omissions in the initial plan: generic expiry/release can lose an unknown pre-link provider hold, and refund/UTC purchase expiry is not fenced by an enrollment lock. The spec's final two sections now bind the exact existing status/writer paths, proposed durable dispatch_unknown transition/release evidence and selected-purchase FOR UPDATE/post-lock DB-time checks. Tasks3/4 and four added matrix rows own their RED races. At that Task1 freeze, Task2+ remained on hold; the subsequent22b re-review accepted both amendments and root authorized Tasks2–4 source/focused implementation.

Normal main10882dc2 was merged without conflicts as3ddebcd2. Task1 only: a detached pure anniversaryWindow.ts plus tests was implemented after13 real behavior RED failures against a fail-closed resolver, followed by a separate original-subscription provenance RED. Thirty tests now pass across anniversaryWindow/newTestPaidCoverage, including published V1 SHA2565819f0d3a6c64943441da1243e78ea403ca7a69c5a9c41b7de49b0beabe1612d and unchanged V1 mid-month rejection. Source never imports the new kernel from consumer/sidecar/admission/usage paths. Scoped lint/diff checks pass. No compiler, full suite, server, PG, provider calls, route activation or dependency install ran; existing read-only root overlay was linked for pure tests. This does not establish V2 ledger safety or hosted customer acceptance.

## Authorized Tasks2–4 execution ledger

Root accepted the22b architecture re-review and authorized source plus focused tests for Tasks2–4; runtime/DDL installation, compiler, full regression and provider IO remain held for the final frozen financial review/window.

Task2 storage/proof implementation: added an explicit fixture-only enrollment/basis/immutable reservation-attribution DDL declaration and known-new setup helper. No DDL has been installed. Prepared V2 intents bind policy/enrollment into both original metadata scopes; V1 request bytes stay on their old path. The service captures enrollment revision before provider IO and fences it before binding; paid-basis activation joins the existing consumer/coverage transaction. V2 full-period evidence has its own closed schema/digest and original-anchor/create-attempt provenance; V1 normalizer/hash is unchanged. SDK retrieval count/deadlines and external IO denial are unchanged. Current application preview/admission/settlement is not yet V2-capable: Tasks3/4 own full-ledger classification, row locks and durable dispatch, so this intermediate commit is not a customer acceptance claim.

Observed2 collection RED failures (ordinary monthly/annual) and4 store/provenance RED failures against fail-closed implementations, then GREEN. Focused original SDK/lifecycle plus V1/V2/provenance/intent cases:128 tests/7 files pass; scoped ESLint and diff check pass. No compiler/server/PG/provider calls ran. V1 digest5819f0d3a6c64943441da1243e78ea403ca7a69c5a9c41b7de49b0beabe1612d remains pinned. Additional intent transaction tests confirm both metadata scopes and revision-change refusal; they are focused unit evidence, not actual database rollback evidence. Task2→Task3 ruling: evidence excludes the eventual paid-basis digest to avoid a digest cycle; it instead binds enrollment, original anchor and original-create-proof digest. The immutable paid basis then references the first collection digest, and current window resolution binds that basis. This preserves the reviewed provenance chain without a circular hash.

Task3 source implementation: shared bounded full-row allocation validates every AI usage/hold, immutable attribution, original basis and purchase identity. It allocates included first and then original-expiry/createdAt/id purchase sources; purchased spend/unknown ceilings are global across buckets. Enrolled never-paid Free and originally-paid verified-inactive Free are separate from active paid coverage; neither absent nor corrupt evidence selects Free. Initial paid activation validates the existing classified Free ledger before completing the joined transaction. Existing application preview/admission select V2 only through authoritative enrollment; legacy/V1 paths retain their original arithmetic. Admission locks the enrollment and selected actual purchase rows, re-reads full facts after locks and uses a final SQL predicate with DB clock, coverage/enrollment revisions and exact current purchase fingerprints/UTC validity. Read snapshots also recheck clock/current authority after ledger IO. Pricing demo/registry commentary accurately label this unactivated source and pending runtime proof.

Observed12 pure allocation RED failures and an additional stale read-clock RED, then GREEN. Focused V1/V2/legacy admission/current-allowance/demo cases:183 tests/12 files pass. New/changed typed modules pass scoped ESLint and diff check. The pre-existing aiCreditReservation.ts file retains its five pre-existing explicit-any lint findings (verified against the prior commit); no new any or suppression was added. Synthetic admission tests exercise refund/UTC/revision/final-CAS refusal and no attribution write; they do not execute SQL or establish database lock timing. Task4 still owns durable dispatch and all actual usage writers/guards; this intermediate commit must not be installed as a usable V2 runtime. No compiler, server, PG, DDL installation or provider calls ran.


Task4 source implementation: the actual generate composition awaits a Serializable existing-hold claim commit before possible billable work; isolated provider denial remains before claim and at provider boundaries. Claims lock the original hold/enrollment, selected actual purchases and current authority, then re-read global financial facts and DB clock before CAS. `dispatch_unknown` survives TTL, missing usage links and generic exceptions. V2 direct and Gateway pending usage join the existing hold transaction; late actual cost retains original attribution across paid activation/calendar boundaries. Gateway's existing cost/margin/cap composition is factored for synthetic fixtures without enabling its denied provider lookup. Exact settled replay returns historical status. Generic metadata cannot supply the reserved namespace. Fixture-only guards require complete linkage at commit, seal completed financial metadata and block generic unknown release/expiry. No provider-specific unused-proof constructor exists, so post-claim release/evidence remains unsupported and refuses rather than fabricating proof.

Observed4 actual usage RED failures, then GREEN; additional RED→GREEN cases cover unknown direct counts, post-authority-lock clock, foreign enrollment before price IO and exact Gateway replay outcome. The final focused set is221 tests/16 files, including V1 original SDK/lifecycle/coverage, anniversary/allocation/admission, late paid/direct/Gateway composition, generic writer/route and legacy/current/demo regressions. Actual V2 IO is exercised against synthetic transactional boundaries: Free100→paid→actual80 keeps paid3000; purchase500 funding100→actual80 keeps purchased420 plus paid3000; a claimed unlinked hold remains counted past TTL; refund/UTC/current-authority changes refuse new hold/claim. Unit tests assert propagation of failed transactional outcomes; real database atomic rollback and both independent refund lock orders remain Task5 evidence, not a claimed result. Scoped ESLint/diff checks pass; the unchanged five inherited explicit-any sites in aiCreditReservation.ts were separately linted with that one rule disabled via command line, no source suppression added. No full compiler/suite, server/PG/DDL installation or provider calls ran.

The source is ready for independent financial/provenance review. Task5 remains unimplemented/unrun: new owned SQL/Next acceptance cases, trigger/immutability/rollback/CAS and actual refund/UTC lock races must be added and run only after review and coordinator grant. No V2 runtime/hosted customer completion is claimed. Main after10882dc2 has deliberately not been merged into this financial source freeze; parent owns the next exact integration target.


## Independent a60 source-review fix round

Root approved one bounded bundle for four confirmed findings: historical paid-included dispatch under current inactive Free, missing final membership lock, invalid double recordset alias, and incomplete sealed Gateway replay comparison. Observed8 RED failures (1paid boundary,2membership changes during purchase-lock await,1SQL shape,4per-field Gateway changes). Fixed current collected permission for the exact original paid bucket, separately awaited exact accepted owner/admin user/org FOR SHARE plus final CAS predicate before DB clock, single `AS w(...) ON` alias, and all sealed replay fields. Positive controls preserve current paid dispatch, original Free→paid funding and already-unknown/pending late paid settlement after inactive status. Financial no-mutation assertions cover refusals and contradictory replays.

Final focused233 tests/16 files pass; scoped lint/diff pass. This is synthetic-boundary evidence only. Actual SQL parsing (including selected=[]), membership demotion/claim lock orders, purchase/refund waits and atomic rollback remain Task5; no compiler/runtime/PG/DDL installation/provider IO ran. The new frozen commit supersedes a60 for source review; no unrelated main source was merged. Primary reviewer closure is required before any runtime gate.

### Task5 source-only fixture handoff

Root approved the existing opt-in owned PG/Next protocol after02c source closure. Test-only fixture/helper source now declares19 additional V2 cases alongside the original eight V1 cases, clean Prisma child environment, unchanged actual refund-writer binding, real lock waiter barriers and known-org Next checks. See `docs/mission/BILLING_ANNIVERSARY_TASK5_FIXTURE_REVIEW.md` and its companion source manifest. No compiler/PG/Next/DDL installation/provider work has run; review and exclusive grant remain required. Natural full anniversary/UTC-month rollover is explicitly unproved: a real SQL lock-wait canary and unchanged-validator synthetic expired full-period negatives do not substitute for it. Local unknown-expiry case allows360s for the genuine stored five-minute TTL; no global timeout or authority clock changes.

Task5 independent fixture review identified one material closure: Prisma CLI checkpoint IO lies outside application provider guards. The owned Prisma launcher now forces CHECKPOINT_DISABLE=1, with absent/false inherited regressions RED2→GREEN2 and complete launcher28/28 PASS. Other fixture helpers/product02c are unchanged; no CLI/DDL/compiler/PG/Next/network run. See Task5 protocol and refreshed source manifest for exact review binding.

First owned-window compiler attempt at9aa exited2 (52.11s), stopping before any container/DDL/PG/Next. Root authorized only the three observed test/helper typing corrections: collected-discriminant narrowing, explicit checked development NODE_ENV and complete frozen Intent fixture. RegressionRED1; window/storage28 +launcher28 focused PASS. Fresh compiler/runtime proof remains pending independent source closure; financial product02c and remaining Task5 helpers unchanged.

At clean781, fresh whole-web8192 types PASS57.60s; one owned attempt failed beforeAll DDL parsing8.30s/42601, all27 cases SKIPPED and Next never started. Cleanup prefix listing empty, window released. Docs-only first-runtime receipt preserves both outcomes separately from old9aa type failure. Static source diagnosis: fixtureAllocationDDL[7] check_test_attribution line73 uses unparenthesized SQL CASE within a PL/pgSQL IF expression. Proposal only wraps CASE ... END, preserving all financial predicates/guards. Statement diagnosis is source/grammar based because the runtime loop had no statement label. No source patch or new runtime before root review.

Root approved the single fixtureAllocation.ts73 SQL CASE parentheses correction, plus safe fixed DDL stage/index failure labels in the opt-in harness. Sole product-file diff from02c is that parentheses pair; all ceilings/raises/triggers/transactions retained. Storage declaration/source tests5 PASS and scopedlint/diff PASS; no parser-success claim or compiler/PG/DDL/CLI/Next rerun. Exact frozen source review precedes types and next owned grant after ECS window.

Second actual setup at b7ff: types PASS55.01s; one owned attempt7.68s reached successful DDL/base/new-enrollment setup, then firstFree200 reserve returned generic unavailable;27 cases SKIPPED, noNext/TTLwait. Cleanup0/window released. Docs-only second receipt and reservation diagnosis preserve source trace/16arg lock-only slot-gap candidate and safe fixture-only observer proposal. No patch/runtime retry or underlyingSQLcode claim.
