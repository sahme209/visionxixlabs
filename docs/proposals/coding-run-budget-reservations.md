# Proposed correction: run-bound coding AI reservations

Design only, requiring user validation and independent review before implementation. No migration, runtime policy, reservation, test, provider call or billing change is authorized by this document. Source baseline `6b337f5d29c0dc8ecc638adbf931642693a70b7b`; exact source identities in `coding-run-budget-design.sources.json`.

## Observed gap and finite objective

`pipelineRunner.ts` strictly verifies cumulative integer stage cost and saved administrator configuration, then uses `resolveRunBudgetCap`/`assertRunCostBudget`. Existing metadata tightening and fail-closed outage/malformed-policy repairs are sound and stay intact. `pickCostAwareModel` has no production callsites and is not the correction boundary.

Actual `codeProposeRealExecutor.generateAttempt` calls `admitAIText` for initial and, if parse refinement is needed, refinement. Their stable phase keys differ. Current admission reserves workspace credits without run identity or run allowance. Completed Gateway usage is pending settlement; executor returns `cost.totalCents:null`, and telemetry maps null to zero. Gateway settlement updates usage/reservation billing records, not the stage ledger. Thus the run allowance is not an admission bound for these calls.

Objective: every coding generation admission must atomically fit the authoritative current run allowance when accounting for actual settled cost plus every unresolved run reservation, across concurrent claims, initial calls and refinement. Preserve existing workspace-credit admission, exact model/output/input guards, one-attempt billing history, AI policy and independent repository-action approvals. This is a conservative reservation-admission guarantee, **not a universal maximum actual provider charge**.

## Required storage decision — explicit approval needed

Current `AIUsageReservation` has organization/key/amount/status/correlation/usage linkage but no durable run/stage/phase relation. Correlation strings and stage output JSON are insufficient authority/indexes. Do not infer run ownership from them or store a new hidden authority ledger in unrelated workflow JSON.

Propose an additive dedicated `PipelineAICallReservation` companion table, linked one-to-one to existing workspace `AIUsageReservation` and exact run/stage rows. Proposed fields: organizationId, runId, stageRunId, phase (`initial|refinement`), stage claim identity, original billing idempotency key, unique workspaceReservationId, actor/correlation binding, admitted estimate cents, admitted cap/source snapshot, durable dispatch/usage linkage, settled provider-cost cents, state/timestamps and overrun/integrity flag. Unique organization/stage/phase and unique workspace hold prevent duplicate phase allocation; indexes support organization/run/state. Constraints verify safe nonnegative cent domains and exact cross-row organization/run ownership. No cascade deletion of consequential history.

This is a **schema/migration proposal requiring separate approval** as part of the correction. No migration is created or applied here. If schema changes are not approved, stop; do not substitute caller `remainingCents`, an unindexed JSON convention, correlation matching or a process-only ledger and call it durable accounting.

## Actual stage authority, not caller numbers

Extend the actual runner's queued→running coding-proposal CAS composition to mint a private, nonserializable, one-stage capability bound to authoritative organization/run/stage/actor and exact claim generation. Mint only after the actual CAS succeeds; never construct from `StageExecutionContext` strings or request JSON. Current `CodingStageClaim` is specific to approved PR-outbound execution, so do not reuse it for proposal inference or import its approvals as inference permission.

For each initial/refinement admission and dispatch claim, reread locked run and stage: exact organization/run relation, pipeline kind, stage kind `code_propose`, active running state, same CAS claim and persisted triggering actor/correlation. Reject canceled, terminal, stale or foreign claims. Preserve current accepted-member/billing-actor checks and current workspace AI/provider/model guards. Generating a proposal must not acquire repository mutation authority or newly require/fabricate a repository-action approval. API-key/system owner substitution remains forbidden.

## One transaction for both allowances

Current `reserveAICredits` owns a transaction and has early returns for legacy, public-anniversary and v2 allocation paths. Current `reserveAndClaim` subsequently claims dispatch in another transaction. The correction needs a reviewed transaction-composable internal reservation operation, not nesting independent commits or a post-hoc check.

For coding calls only, the coordinator opens a serializable transaction, locks the exact run as the common serialization point, checks the private stage claim/locked stage and strictly loads current saved budget policy using the same transaction. A missing optional policy is verified absence; read/malformed errors refuse. Metadata may only tighten the saved allowance. Read authoritative run cost/holds, compute the proposed server-owned request estimate, and require it to fit. Then execute the existing workspace reservation checks/creation and write its exact run companion atomically. All early-return allocation branches must participate; unsupported/missing composition fails closed rather than silently dropping the run constraint.

Use a single documented lock order across admission, dispatch, safe release, settlement and any run-state writes: run → stage/companion → workspace billing/allocation/usage locks, adjusted consistently with existing public/v2 lock requirements after review. No provider I/O inside transaction. A serialization conflict refuses/returns current state; no automatic paid retry. A workspace refusal or companion failure rolls back both allocations. Do not release another caller's hold.

Immediately before minting the one-use manager admission, claim dispatch in a transaction under the same run lock: recheck current run/stage/actor/policy, cap, companion and exact workspace hold, then advance both to dispatch-unknown atomically. Concurrent initial/refinement/stage claims see the full aggregate, so they cannot each independently spend the same headroom. An existing phase/hold remains consumed/unavailable; it cannot mint another SDK attempt. Normal current-policy tightening/cancellation is honored before dispatch claim. Cancellation after a durable claim is not a promise that provider dispatch was prevented.

The admission object stays opaque and bound to this exact original call; no public `remainingCents`, `trustedBudget` or serialized override. Existing manager one-attempt consume, bounded inputs/output and usage linkage remain in force. This reusable boundary covers both phase callsites; neither calls the soft model picker for authority.

## Accounting basis, unknown and settlement

Preserve the run's provider-cost cent meaning (`UsageEvent.costCents`), distinct from margin-adjusted/capped customer billing (`billedCents`/`AIUsageReservation.settledCents`). Proposed admitted exposure is:

`authoritative settled provider cents + all unresolved run admission estimates + verified other-stage costs + proposed estimate`.

Do not double count settled bound coding calls through stage telemetry. Stage cost becomes a display projection of exact linked finalized calls, with pending/unknown exposure shown separately; never turn unknown into verified zero for admission. Other-stage cost is included only once and only from current valid evidence. An old in-flight coding run lacking exact companion bindings cannot be reconstructed by correlation or treated as zero: preserve history and refuse further paid admission until a separately reviewed reconciliation path exists.

`reserved`, `dispatch_unknown`, and `pending_settlement` companions consume their full admitted amount. A completed first call awaiting authoritative billing may allow refinement **only if the sum including its full hold fits**; do not replace real accounting with a blanket pending halt. A lost response/unknown SDK outcome keeps its hold and original phase consumed, without TTL-based release or resend.

Release exposure only by an atomic exact pre-dispatch proof that both companion and workspace hold remain reserved, no dispatch was claimed and no effect can have started. Released phase history remains terminal, not an excuse to mint a replacement nonce. Expired pre-dispatch holds require the same no-dispatch proof; unknown/pending never expire into free allowance.

Settlement must update usage, existing workspace reservation/allocation and companion in the same transaction, keyed to exact generation/usage/hold/run. Reuse the authoritative generation receipt validation, and extend both legacy and public/v2 settlement compositions; the v2 early return cannot skip the run update. Duplicate settlement is idempotent, mismatch/read failure preserves unresolved exposure. Replace estimate with verified provider cents once only. If actual provider cost exceeds its estimate, record the full actual amount and an anomaly, stop further paid run calls and report the overrun; do not clip provider cost, silently reset the ledger or retry. Existing customer-debit clipping/allocation semantics stay unchanged. If the newly settled sum exceeds a tightened run cap, halt/report subsequent paid work; no claim to undo prior provider spend.

No terminal success/UI should claim a run stayed within actual cost while billing remains pending. Separate recorded task success, pending allowance exposure and authoritative final provider cost.

## Default mismatch and useful quoting remain explicit

Current request hold defaults to1,000¢ while the platform run cap defaults to500¢. A correct conservative foundation must therefore refuse that first default hold. **Do not silently raise the run cap, shrink the workspace hold, choose a cheaper unapproved model or call that useful pipeline completion.** This safety foundation alone does not finish the user's usable measured-budget workflow.

Useful smaller admissions need a separately reviewed exact coding-request quote bound to final prompt/system, concrete permitted model, enforced output limit, input bound, pricing evidence/digest/expiry and current scope, with conservative cent arithmetic and no fallback when unsupported. Existing `smallSonnetRequest.ts`/`smallSonnet55Request.ts` are narrowly structured-extraction/public-Free contracts with particular model and payload behavior; current `admitAIText` does not use them. They are source examples, not reusable authority for arbitrary coding prompts, paid/legacy accounts or generic Gateway models. Their live quote fetch is not run or authorized here. Reusing their pricing parser/one-use pattern requires explicit contract review; no copied rates, model substitution or provider-price lookup in this design batch. Any future coding quote must coordinate workspace and run holds under the same transaction and remain an estimate, not an actual provider-charge guarantee.

## Scope and validation plan — not executed

Current registered real coding executors are `code_read`, `code_propose`, `code_lint`, `code_test`, `code_pr_open`; only `code_propose` contains these initial/refinement AI generations. Read/lint/test use source/provider reads/local checks and PR-open has separate approved outbound execution. Other generic pipeline kinds default unavailable; arbitrary registered future/custom executors are not automatically run-bound AI coverage. General Agent/Bot/extraction/background AI paths are excluded. Document this finite coverage honestly.

After approval, focused synthetic handler/transaction tests should prove: exact run ownership and real CAS capability; tiny cap refusal before admission/SDK; hold-fits boundary; concurrent competing holds cannot both exceed allowance; separate initial/refinement once each; pending first hold counted for refinement; workspace refusal/transaction rollback on every allocation branch; current policy tightening/cancel before claim; unknown/crash no-release/no-resend; exact settlement once, mismatch retains hold; actual-over-estimate records full cost and blocks; no telemetry double-count/legacy-null-as-zero; default1,000/500 refusal; existing workspace/AI/provider/output/approval rules unchanged. Use current `codeProposeAdmission`/runner budget/billing reservation and settlement seams. Real DB transaction acceptance and any migration validation need separately authorized owned fixtures; no customer/provider operations or claim of universal concurrency correctness from mocks.

Implementation, schema/migration, quote-contract extension and exact validation scope require user approval following independent source/design review. This proposal performs none of them and changes no production authority.
