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
- [ ] 2. Add `agentActionExecutionContract.ts`, `agentActionExecutionStore.ts` and actual isolated PG journeys. Exact new review evidence is mandatory; deterministic org+proposal+digest operation identity prevents duplicate records across sessions. Existing durable workflow/events and one-attempt/CAS/lease/outcome patterns; current DB clock, actor/approval/tool/target checks; old rows refuse. Tests: positive, current-role/source changes, same-session recovery, concurrent claim, unknown consumed and tenant isolation.
- [ ] 3. Add trusted paired request/HTTP composition and separate execution route; bind actual stored operation to fixed responder/transports. Closed per-tool requirements mirror direct APIs. Require current requester/session, separate current reviewer, Agent tool policy, exact target/source and connection revision before claim and final dispatch. Preserve current Government refusal until actual coverage exists. Real transport with simulated provider lost-response/refusal tests; no no-op guard.
- [ ] 4. Update desktop/client DTO and Agent view plus web decision presentation: approved/waiting distinct from executed; only designated requester sees deliberate Execute; reviewer sees no executor control. Separate read-only operation history/recovery; no automatic model continuation or resend. Keyboard/error/expiry/restart/uncertain tests and frontend types/build.
- [ ] 5. Review complete composition and fix findings; batch exact production/frontend/native verification, record simulated versus real-store evidence, backup exact source. Broader project failures remain explicit. Prepare a reviewable activation package only; do not deploy or perform live decisions.

Each task has an independent source/test/review receipt. Keep this checklist and master plan current. No task or fixture proves complete Governance enrollment by itself.

## Task1 receipt and limits

Review-only decisions pass20 unit checks,8 actual route checks and6 isolated PostgreSQL journeys with simulated identity policy. Database time after source/membership locks fixes a reproduced real lock-wait expiry race; no execution/provider call occurs on approval. Scoped server types pass and independent source review found no important security issue. Helper self-rejection exists, but current reject entry routes retain their previous approver gate; broader requester stop UI/route alignment remains Task4 and is not accepted by helper tests. The rest of the plan is unfinished. Native waiting controls and separate execution do not exist yet; do not ship this intermediate source as a completed workflow.
