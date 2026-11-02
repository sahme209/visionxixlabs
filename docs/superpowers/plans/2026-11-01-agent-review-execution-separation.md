# Agent Review and Requester Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Human review records an exact decision without execution; a separately authenticated requester executes once with current authority and durable recovery.

**Architecture:** Retain AgentActionProposal as the exact proposal and append immutable versioned review evidence. A new existing-table durable execution record binds that evidence to the original requester/session and one attempt. Fixed transports require current stored-operation authority; native controls distinguish review, execution and outcome recovery.

**Tech Stack:** Existing Next paired HTTP, Prisma/PostgreSQL durable workflow/events/audit stores, Zod contracts, TypeScript and native React client; no dependency or schema addition.

**Spec:** docs/recovery/2026-11-01/agent-review-execution-separation-proposal.md, user approved local implementation November1.

## Global constraints

Local code and simulated/isolated database tests only. No provider actions, deployment, grants, schema migration or old-approval adoption. Preserve consumed unknown history. No automatic execution/resend/claim retry. Original proposer is the designated executor, distinct from independent reviewer. Unknown or unenrolled coverage never grants baseline authority.

## Review focus

Old approved/executed/failed proposals must not become new execution authority; current permission differs from saved role labels; proposal/digest/expiry changes across awaits; ambiguous provider outcomes and concurrent claims; browser and desktop decisions plus native restart/response-loss behavior.

## Tasks and acceptance

- [x] 1. `browserApprovalDecision.ts` and decision tests: record approved only, zero responder/provider invocation; current persisted accepted reviewer authority in decision transaction; exact digest and source CAS; versioned immutable review marker; separate rejection/self-stop behavior. Test RED→GREEN before commit. Do not claim the execution workflow is ready yet.
- [x] 2. Add `agentActionExecutionContract.ts`, `agentActionExecutionStore.ts` and actual isolated PG journeys. Exact new review evidence is mandatory; deterministic org+proposal+digest operation identity prevents duplicate records across sessions. Existing durable workflow/events and one-attempt/CAS/lease/outcome patterns; current DB clock, actor/approval/tool/target checks; old rows refuse. Tests: positive, current-role/source changes, same-session recovery, concurrent claim, unknown consumed and tenant isolation.
- [ ] 3. Add trusted paired request/HTTP composition and separate execution route; bind actual stored operation to fixed responder/transports. Closed per-tool requirements mirror direct APIs. Require current requester/session, separate current reviewer, Agent tool policy, exact target/source and connection revision before claim and final dispatch. Preserve current Government refusal until actual coverage exists. Real transport with simulated provider lost-response/refusal tests; no no-op guard.
- [ ] 4. Update desktop/client DTO and Agent view plus web decision presentation: approved/waiting distinct from executed; only designated requester sees deliberate Execute; reviewer sees no executor control. Separate read-only operation history/recovery; no automatic model continuation or resend. Keyboard/error/expiry/restart/uncertain tests and frontend types/build.
- [ ] 5. Review complete composition and fix findings; batch exact production/frontend/native verification, record simulated versus real-store evidence, backup exact source. Broader project failures remain explicit. Prepare a reviewable activation package only; do not deploy or perform live decisions.

Each task has an independent source/test/review receipt. Keep this checklist and master plan current. No task or fixture proves complete Governance enrollment by itself.

## Task1 receipt and limits

Review-only decisions pass20 unit checks,8 actual route checks and6 isolated PostgreSQL journeys with simulated identity policy. Database time after source/membership locks fixes a reproduced real lock-wait expiry race; no execution/provider call occurs on approval. Scoped server types pass and independent source review found no important security issue. Helper self-rejection exists, but current reject entry routes retain their previous approver gate; broader requester stop UI/route alignment remains Task4 and is not accepted by helper tests. The rest of the plan is unfinished. Native waiting controls and separate execution do not exist yet; do not ship this intermediate source as a completed workflow.

## Task2 receipt and limits

New exact-review evidence and requester execution store are implemented locally.14 contract checks plus20 review regressions pass;16 actual isolated PostgreSQL journeys pass, with simulated request/commercial authentication and no provider transport. Scoped source types and final independent review pass after a restart-classification finding was fixed. Record identity excludes session, old review markers cannot qualify, role/policy/source changes refuse, unknown attempts stay consumed and private result recording survives revocation. Real30-second lease expiry exposes read-only uncertainty without rewriting stored history. The store is unmounted and enrolled scopes refuse. Original-request lookup/HTTP, actual target/credential transport composition, client and native recovery remain Tasks3–4; no end-to-end execution or shipping acceptance is claimed.

## Parallel Tasks3–4 progress (still unchecked)

Current local requester route handles only recovery/preparation/cancel, with default-OFF preparation and no execute dispatch. Store includes exact pre-claim inspection, single-use atomic DB apply and a final coherent review/installation check;27 actual isolated PostgreSQL store journeys pass with simulated request/provider boundaries. Native/browser record-only waiting and read-only recovery are implemented/tested, without inferred legacy eligibility or automatic continuation. Self-stop route/helper ordering is tested separately. The fixed coordinator, deployment path, true registered Governance coverage, designated requester eligibility and deliberate execution control are still incomplete; neither task is accepted as complete. See the November1 requester HTTP, approved waiting and self-stop local-progress receipts for exact evidence and limits. Backend/frontend are being handled in parallel under the user's updated instruction.

## All fixed adapters/current controls local increment (Tasks3–5 still open)

All8 existing fixed tools now compose through the separate coordinator locally.50 backend checks,29 actual store PostgreSQL journeys,10 actual coordinator PostgreSQL journeys,32 frontend client/panel checks, scoped types and desktop frontend build pass. Request/human/token/provider boundaries are simulated; no production/native/human acceptance is implied. The policy-insertion final-snapshot race and lost-preparation response hold were reproduced and corrected. Backend readiness/execute HTTP, immutable source binding, complete end-to-end native workflow and final production/native verification remain unfinished. See ../../recovery/2026-11-01/agent-all-tools-local-progress.md. Never ship this partial workflow as full Governance.

## Requester HTTP composition increment (Tasks3–5 remain unchecked)

Current local API now projects shared strict readiness metadata and executes only a saved operation through current paired requester authority.34 actual isolated store/API journeys,70 boundary/client checks and scoped server/desktop types/frontend build pass; identity/provider boundaries remain simulated. No private readiness source is serialized, no client permission field is accepted, and the deadline reaches the worker. Branch/PR/AWS immutable source paths remain hard-blocked at the public service; completing them is required for the original full scope. Native/current actor discovery, complete conversation/outcome presentation, broad Governance admission/coverage and exact whole-project/native verification remain open. See ../../recovery/2026-11-01/agent-requester-api-local-progress.md.

## Local PR source increment — Tasks3–5 still open

Captured head/base commits are now displayed, rechecked before fixed PR creation and verified against its response. Current HTTP/database journeys and receipt readback pass; legacy sources refuse. Symbolic refs are not frozen, and mismatch/loss stays consumed unknown. AWS source binding, conversation/restart presentation, native/full customer acceptance and true Governance admission/coverage/enrollment remain incomplete. No activation or provider action is implied. Exact receipt: ../../recovery/2026-11-02/agent-pull-request-source-local-progress.md.

## Local conversation outcome read — final workflow gates remain open

Bounded current requester/owned-conversation outcomes are read into the next explicit user request as historical facts, separately from UI selection or execution permission. Current session/ownership, no mutation, new-session recovery, strict privacy/size, no client override and no automatic continuation are locally tested.207 focused and45 actual store/API PG cases pass with simulated external identities/providers/models. Native/live/full customer acceptance and true Governance/AWS source coverage still remain; Tasks3–5 are not accepted as complete. Receipt ../../recovery/2026-11-02/agent-conversation-outcomes-local-progress.md.
