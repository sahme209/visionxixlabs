# Platform Governance implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task. Owner already selected continuous native execution; one fresh whole-source review before PR, no redundant execution-method checkpoint.

**Goal:** Complete P01's managed deployment/template/growth enforcement with exact platform authority, independent review, durable one-attempt effects and honest external administrative boundaries.

**Architecture:** Dedicated platform contracts/storage; no fabricated organization. Server-authenticated callers and current reviewer/session suppliers feed a transactional action service. Effect adapters consume only exact claimed operations; unknown remains consumed. Existing controls stay intact.

**Tech Stack:** Existing TypeScript, Zod, Prisma/PostgreSQL and Vitest; no dependencies.

**Spec:** docs/recovery/2026-11-12/platform-governance-scope/PROPOSAL.md (owner approved local implementation/tests).

## Global constraints

No production migration, deploy, post, credentials, grants, spending or actual provider access. Local schema/owned isolated SQL and synthetic transports only. Keep P01 uncovered until all managed default paths are proven; external dashboards remain an explicit administrative trust boundary. No change to historical qualification or existing release permissions.

## Review focus

Current reviewer revocation after approval; simultaneous claims; child-effect uncertainty; warm caches/access-grant bypass; direct scripts/cron outside an application wrapper. Each receives behavioral tests below, not a list-edit coverage claim.

### Task1 — exact platform contract and pure transitions

Files: lib/governance/platform/contracts.ts, kernel.ts, __tests__/kernel.test.ts.
- [x] RED: strict effect-specific plan bindings; reject organization/requester-approved booleans, missing target/config digest, changed payload, self-review, expiry, consumed/unknown replay.
- [x] Implement immutable compilePlatformPlan(raw), approvePlatformAction(state,review,now), claimPlatformAction(state,actor,now), finishPlatformAction(state,outcome). Explicit platform scope/family/effect/source/target/payload and distinct identities. SHA digest; no content/secrets stored.
- [x] GREEN focused Vitest; commit tested source and evidence.

### Task2 — dedicated local schema and transactional service

Files: prisma/schema.prisma (additive definitions only), lib/governance/platform/actionStore.ts, sqlRepository.ts, tests.
- [ ] RED: duplicate/concurrent claims, exact version, event rollback, current authority before/after awaits, revoked reviewer, expiration, unknown commit, child unknown halts parent.
- [ ] Implement dedicated PlatformGovernanceAction/Event/Effect definitions and repository; no organization alias. Existing fixed-schema fixture pins require reviewed additive delta, not blanket re-pin. No production migration.
- [ ] Service createPlatformActionService(repo,authority): propose/review/claim/observe with transaction DB time, current actor/reviewer, exact request binding, one-use final-send proof. Unknown terminal; no automatic retry.
- [ ] GREEN mock repository and actual fresh owned PostgreSQL tests with simulated identity/effects; stop owned PG.

### Task3 — actual authority and default request composition

Files: lib/governance/platform/currentAuthority.ts, requestService.ts, tests.
- [ ] Inspect actual auth/session revocation source; RED stable current admin/requester/reviewer and API-key/cron refusal without exact supported source.
- [ ] Mount server-authenticated principal and immutable approved references; missing session/revocation supplier refuses rather than treating an old user ID as live authority. Require genuine independent decision.
- [ ] GREEN composed route/store tests; no real account/session/credentials or listener.

### Task4 — all managed effects and bypasses

Files: inventoried deploy/template/growth helpers, callers and operational scripts in proposal; narrow platform effect transport.
- [ ] RED each actual credential/SDK/fetch seam before provider work, including template signed URL/cache/override, image init/PUT, post/delete/schedule, deployment/settings/rollback.
- [ ] Connect exact plan and current claim to default final send; provider-supplied upload destination cannot widen scope; explicit retry policy. Cron refuses until its exact scheduled authority qualifies. Preserve existing auth/flags/budgets.
- [ ] GREEN default-path simulated effects and bypass tests. Do not claim out-of-band dashboard prevention.

### Task5 — complete workflow and documentation

Files: platform review/execute UI/HTTP, relevant docs/ModuleIntro/demo/corpus, current coverage record.
- [ ] Show exact platform effect, requester/reviewer, next action, expiry, confirmed/refused/unknown history and no replay.
- [ ] Test real composed lifecycle with synthetic actors/provider and actual isolated storage; source-ground guides/knowledge. Unsupported operation labels stay honest.

### Task6 — acceptance and one PR

- [ ] Requirement audit across proposal and source inventory; no family left behind or peripheral refusal substituted for connected workflow.
- [ ] Full required tests/types/builds; real isolated SQL distinguished from live acceptance; independent whole-source review.
- [ ] One PR, all applicable exact-head CI green, normal merge. No production activation. Record unresolved owner/live/administrative boundaries.

## Initial source evidence

Task1 local kernel/contracts:9 tests pass after actual missing-module RED. Transaction service adds7 in-memory tests: one concurrent claim, durable event rollback, current requester/reviewer rechecks, per-child order, terminal unknown, no replay and opaque observation proof. Actual fresh isolated PostgreSQL adds3 non-skipped tests for duplicate serialization/event rollback/unknown preservation. Default authority and every provider effect are simulated/unmounted. Owned fixture `/private/tmp/axiom-platform-pg-1rgnloqn` stopped with pg_ctl status3. Strict root types pass after fixing captured optional-binding narrowing; original error log retained.

Three additive Prisma definitions and fixture-only SQL are local, not a production migration. No generation/build/pin renewal or complete-schema compatibility claim. Tasks2–6 remain open until default identity composition, full effect/workflow coverage, adversarial tests, review and CI.
