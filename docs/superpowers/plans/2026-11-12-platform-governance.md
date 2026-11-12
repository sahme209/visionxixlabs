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

### Current platform authority source — local only

Current authority now joins real User, DesktopSessionRecord and accepted OrgMembership columns under shared row locks, checks DB-time session issuance/expiry/revocation, and re-reads the deployment-admin allowlist after awaited lookup. The pairing workspace only validates session membership; it never owns the platform action or grants platform privilege. Three pure/injected authority checks pass after missing-module RED. Five actual isolated-PG tests pass (the prior3 plus2 using actual identity/session/membership SQL); token possession/authentication and provider behavior are not simulated as real acceptance. Fixture `/private/tmp/axiom-platform-pg-41cd3qqp` is stopped. Strict root types pass.

Next: bind actual authenticated request possession to this reader and the service; then mount final effect boundaries/workflow, complete source review/whole validation. Existing NextAuth JWT alone has no durable per-session revocation row, so it must not be relabeled as one. No route/provider/cron allow path or P01 readiness is enabled. Identity fixture represents only the exact consumed SQL columns, not full production-schema qualification.

### Request possession and final effect authorization

Private default request composition now verifies the existing desktop-token HMAC before database lookup, derives stable identity from the real paired-session row, and joins current platform authority. No caller-supplied actor, API-key/cookie/cron fallback, heartbeat or membership self-heal is introduced. Possession is rechecked around awaited authority reads and cannot switch to another session after binding. The existing signing-key selection is reused unchanged; tests use only an ephemeral synthetic key, never a real credential.

A separate one-use final-effect check binds exact target/effect/requester and rechecks both humans and expiry after claim. Confirmation without that final authorization now refuses; a consumed or failed authorization is never restored. This is prepared source for the eventual transport, not proof that existing provider helpers enforce it yet.

Actual request-source missing-module RED and final-effect behavioral RED4fail/6pass preceded implementation.27focused kernel/store/authority/request checks pass. Seven actual fresh isolated-PG cases pass, including2 through the default request factory with actual HMAC verification and real SQL; synthetic users/key and no provider transport. Latest fixture `/private/tmp/axiom-platform-pg-1fu7iugt` stopped; prior accepted fixture `/private/tmp/axiom-platform-pg-cekt2i6s` also stopped. No real sign-in, credentials, HTTP route registration, live provider, schema apply, deploy or P01/full-Governance acceptance.

Next: final source review/types, then exact effect-adapter/caller coverage and complete workflow. Dedicated proposed tables still have no production migration, and historical schema pins have not been renewed.

### Default deployment boundary mounted locally

The private execution binding now connects an authenticated, independently reviewed parent claim to an exact child effect, final one-use authorization and one provider attempt; invented/client JSON bindings refuse. Unknown/failed recording never returns a successful value or retries. Default Vercel deployment helpers now require this binding before reading credentials or dispatching. Wrapper signatures carry the same private binding; legacy routes still need the complete approved preparation/review/execution workflow and currently refuse unadmitted deployment rather than bypass. No guard-only feature completion or publication is claimed.

Source inspection corrected a misleading proposed target field: the existing Vercel request uses a project name and may create that named project. Local plans now bind projectName, explicit team scope, environment, file-byte digest, configuration digest and literal creation-risk label. No credential value is persisted or hashed into a plan. This is request-data binding, not native issuer/runtime qualification or proof a deployment became READY.

The actual final HTTP request uses fixed origin, redirect refusal,15-second abort and128KiB bounded response decoding. Missing request ID or contradictory production target remains unknown. Existing non-READY/missing-URL/unsupported-provider and explicit-production assertions remain, now supplied with synthetic claimed authority instead of an implicit bypass.50initial focused checks passed; production-target mismatch then reproduced RED1/6 and corrected GREEN60across4files. Source type widening found/fixed with exact discriminated effect annotation; root types passed before the last narrow target-refusal test change.

Nine actual fresh owned PostgreSQL tests passed at `/private/tmp/axiom-platform-pg-6g3tnq2z` (server stopped), including2 actual default request/HMAC/SQL/deployment-helper cases with simulated HTTP and synthetic credentials. Those cases predate only the final contradictory-production-target refusal. Receipt hashes cover the enumerated platform/schema sources, not a complete transitive artifact attestation. No real Vercel/provider request, account, spending, installation or deployment. All other P01 families and full workflow remain open.
