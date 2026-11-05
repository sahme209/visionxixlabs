# Workspace text policy freshness — local repair proposal

Design for review only. No runtime implementation, production activation or provider action is authorized by this document.

## Verified defect

The one actual owned-PostgreSQL diagnostic observed a new reservation after the generic route's initial policy read, then disabled that workspace's stored AI policy before releasing the accepted-member lock that blocked its durable claim. The unchanged route returned200 and reached the installed SDK's synthetic final fetch once while the actual stored policy was false. One pending usage/hold link was written. Setup succeeded and membership remained accepted; no real provider was contacted. The desired refusal regression stays RED.

This is a local-source result, not a production exposure or complete threat assessment. Existing membership, idempotency, budget and unknown-outcome checks still have their own bounded evidence; they do not substitute for current provider policy.

## Required behavior and local implementation scope

1. Extend the existing text admission producer and one-use admission record with a strictly validated server-owned request-policy requirement: exact workspace, actual actor/request/task, Gateway provider and resolved concrete model. Reuse the existing capability, reservation and claim lifecycle rather than adding another ledger, public endpoint or request-supplied bypass flag. A serializable request-body object cannot issue or replace authority.
2. Trace and update both current production `admitAIText` callers: generic generation and the fixed-hold coding-proposal path. Each must obtain the requirement from its actual current policy/model composition. Missing or mismatched requirements refuse before SDK dispatch; do not preserve a silent compatibility bypass. Preserve the quoted coding path's separate price/claim semantics. Quoted text, extraction, streaming and direct legacy callers must be explicitly inventoried as either covered by the resulting shared boundary or still incomplete; never declare universal coverage from this first repair.
3. In the existing durable dispatch-claim transaction, re-read the exact workspace policy with a shared row lock alongside the real accepted-member check. Use existing strict stored-policy normalization, opt-in semantics and effective model selection. Missing, malformed, disabled, unavailable or changed provider/model authority refuses; neither default service credentials nor the earlier cached policy can grant access. The source policy is currently opt-in, so a missing row cannot become permission. Confirm lock ordering against the supported writers before running the race tests.
4. Bind the admitted provider/model to the actual manager/SDK options consumed once. A different final model, scope, task or reused capability refuses. Recheck current policy at the final supported dispatch boundary after intervening awaits; no additional async preflight-only check may be presented as closing this defect. If exact enforcement cannot be composed through the existing boundary, keep it unavailable and report the remaining design gate rather than introducing an unreviewed transport fallback.
5. Retain conservative financial and history semantics. A refusal must not dispatch, reissue a capability, clear a consumed key, automatically retry, change the model or release a possibly claimed hold. Use only the existing proven pre-dispatch release rules if applicable; introduce no new refund/settlement rule, status or accounting authority. Unknown outcomes remain unknown.
6. Define the logical admission/final-check decision points and remaining races explicitly. Shared policy locks serialize supported updates with the claim, but do not prove cancellation of already-dispatched work, physical wire atomicity, fleet-wide custody or elimination of every interval between checks and remote effects. Do not hold a transaction across an unbounded model response or invent a promise that the switch recalls a previously sent request. Full A2 executing-issuer, final-transport, legacy/fleet and resource-ownership gates remain separate.

## Acceptance before any activation proposal

- The preserved actual-store disable-before-claim regression changes from RED to GREEN without mocking policy, financial, claim or usage primitives.
- Actual enabled-policy positive generation still performs one durable claim/one synthetic SDK attempt/one linked usage. Missing, malformed, disabled and changed model/provider policies refuse in the supported producer paths.
- Controlled policy changes around both claim and final dispatch checks, member revocation, expiry, same-key concurrency, final-option mismatch and reused capabilities do not bypass the supported authority boundary. Record the exact schedules and refusal mechanism; do not infer all interleavings from a few cases.
- Quoted/fixed/extraction/stream/direct-call inventory stays explicit. No price qualification, capability issuance or silently restored path follows from a green generic test. Unsupported compositions stay unavailable.
- Scope types, actual installed-SDK synthetic captures, isolated database journeys and independent code review pass. Preserve every failure and exact source binding. No repeat of unchanged passing suites just to increase counts.

## Requested authorization and exclusions

Requested next decision: local source implementation and ordinary isolated synthetic/database tests of this policy-freshness repair, including the actual caller/claim/consumer composition and explicit remaining-coverage inventory. This changes a current authorization boundary, so the user's validation-first review requirement applies before code changes.

No production schema/migration, new feature flag, deployment, provider/customer read, real AI call, credentials, grants, purchase, paid CI, price change or production enablement. Current previews, paired sessions, real database backups and ServiceNow's already-written unknown note remain untouched. This approval would not resolve the separate pending Governance preparation, health-metadata or funded-helper decisions, and would not establish completed Governance or A7.
