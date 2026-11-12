# Generated-site Deployment Liability and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with the preserved inline method. Steps use checkbox syntax.

**Goal:** Complete generated-site deployment execution, durable result recovery and separately reviewed terminal release without replaying an uncertain write.
**Architecture:** The existing private effect service reserves a canonical team/project/environment generation before dispatch. Private transport receipts commit atomically with effect/event/parent state. A separate independently reviewed observation releases only an exact qualified terminal generation; no default native supplier is invented.
**Tech Stack:** Existing TypeScript/Zod/Prisma definitions, raw parameterized PostgreSQL fixture, React prepared clients; no new dependency.
**Spec:** docs/recovery/2026-11-12/platform-governance-scope/DEPLOYMENT-RECOVERY-PROPOSAL.md

## Global Constraints
- Local code/additive source schema/owned isolated SQL and intercepted provider tests only. No production migration, provider/account/credential/grant/flag/workflow/signing/install/deployment/spending.
- Key includes provider+team+project+environment; excludes action/Lead/files/request UUID. Unknown and accepted-pending liability stays held.
- Immutable original receipts/history; no backfill/reset/renew/retry. Accepted is not READY.
- Genuine distinct review/current requester and source checks at send/release. No default real qualification or client Boolean authority.

## Review Focus
- Different action/Lead/source cannot evade a held target.
- A lost observation commit cannot return a usable result or retry.
- Missing/altered provider identity cannot become known acceptance.
- Revocation after a native send cannot erase truthful evidence or release output.
- Delayed terminal evidence cannot release a newer generation.

### Task1: Exact reservation/receipt/release kernel
Files: create lib/governance/platform/deploymentLiability.ts and __tests__/deploymentLiability.test.ts.
Interfaces: nativeDeploymentKey(effect), reserveDeploymentTarget(effect,actionId,index,planDigest,sourceDigest,now,previous), observeDeploymentRequest(reservation,receipt), releaseDeploymentTarget(reservation,qualifiedObservation,now). Strict exported schemas bind exact target/action/generation/version/context and enforce CAS-compatible next state.
- [x] Write failing tests for clone-proof key, held/unknown/accepted exclusion, immutable accepted metadata, exact terminal generation release and stale/mismatched/refused observations.
- [x] Observe RED; implement pure transitions; observe GREEN.
- [x] Commit source-scoped evidence without claiming full workflow.

### Task2: Actual SQL and private send/result composition
Files: add dedicated local Prisma/fixture target+receipt definitions, deploymentLiabilitySql.ts; extend actionStore.ts/sqlRepository.ts/effectExecution.ts/requestComposition.ts; modify lib/deploy/provider.ts; tests existing provider and actual SQL fixture.
Interfaces: optional typed target lock/read/insert/CAS/receipt methods on PlatformTransaction, required for a deployment send. Private observeEffect may accept only validated deployment-result metadata behind its owned proof; generation/source come from the locked reservation. after-observation result authorization is one-use and cannot send.
- [x] RED target duplication across distinct approved actions, receipt/event atomicity, unknown hold, known result with lost acknowledgement and no return/retry, post-send revocation, missing/mismatched receipt.
- [x] Implement target reservation in final send transaction, typed receipt atomic with child/event/parent, and private current output gate. Keep nondeployment behavior unchanged.
- [x] Review additive schema against existing DMMF before updating only current mock-helper schema pin; never renew historical packets. Generate only local client/fixtures.
- [x] Run focused/types and actual isolated SQL; record simulated provider/profile scope; commit.

### Task3: Exact independently reviewed observation/release
Files: deploymentRecoveryContract.ts/store.ts/http.ts, prepared desktop client/panel and full SQL cases.
Interfaces: original receipt/native key/generation selection, source-backed terminal supplier, distinct review and original-requester one-use read-only observation; exact-generation CAS release. Defaults refuse absent native qualification.
- [x] RED stale/mismatched/pending evidence, self-review/revocation/expiry, event rollback, competing releases and changed generation.
- [x] Implement through existing platform authority/ledger, no provider write or caller-selected URL. Original unknown-without-reference remains blocked.
- [ ] Prove genuine synthetic-current SQL lineage and immutable old outcomes; wire prepared source/history UI without public registration; update internal demo/guidance.

### Task4: Complete prepared execution/customer workflow and batch acceptance
Files: deploymentHttp/requestService/default caller, desktop platform prepared workflow/result metadata, coverage and living docs.
- [ ] RED actual proposal→review→requester→default helper→receipt/history and sequential separately approved release/new action, with native transport intercepted.
- [ ] Complete current authenticated original-reference workflow; display accepted/pending/unknown truthfully, no READY inference or repeat button.
- [ ] Validate required source/frontend/types/build/isolated storage and final whole-family source audit. The existing final whole-batch independent review/one exact-green PR remains after all three approved families; not a separate guard-only PR.

Ruling: owner explicitly approved all three local designs and continuous inline execution; no extra plan checkpoint. Template/image remain in full scope and follow this first dependency unit. Real qualification remains separate.

Task1/Task2 source milestone:14kernel checks,75focused,20schema/demo,128actual isolated SQL and root types PASS. Remaining Tasks3–4 unchanged; no full workflow claim. Existing-model metadata comparison and exact local schema helper re-pin recorded; no historical packet authority renewed.
