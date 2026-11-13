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

### Local managed template effects

Default template hosting now separates exact bucket creation, conditional object upload and signed version-access grant. The legacy GET, memory cache and operator URL override cannot confer authority; unadmitted calls return a fixed review-required response before AWS credential/client access. No raw AWS errors or signed URLs enter action/event storage.

The owner-approved three public AWS documentation reads are consumed; findings and links are in `docs/recovery/2026-11-12/platform-template-hosting/AWS-SOURCE-REVIEW.md`. Creation explicitly refuses the documented us-east-1 ACL-reset hazard; the supported local creation profile is us-east-2 and never treats conflict as success. Existing us-east-1 versioned objects may still use the bounded upload/read/access profiles. Clients use explicit regional endpoints, no region redirect and maxAttempts1.

Uploads use full SHA256 content-addressed keys, IfNoneMatch*, expected owner and observed enabled versioning. Versioning is never enabled automatically and its setup/IAM authority remains a separate owner/live requirement. A confirmed unversioned result is never turned into a usable access grant. Access always rereads exact version/owner/bounded bytes and validates signer output's host/path/version/expiry/credential scope/signature/header profile; URLs remain transferable bearer credentials, not cryptographically bound to the intended-recipient metadata.

Tests: initial missing-module RED; actual installed-signer compatibility RED (reviewed constant query marker fixed); malformed signing evidence RED; missing versioning RED; revocation during asynchronous signing RED→GREEN.22focused checks across3files now pass, including the actual installed signer with synthetic keys and simulated SDK I/O. Eleven actual owned PostgreSQL cases pass at `/private/tmp/axiom-platform-pg-m5zw_i4n`, including2 joined default HMAC/request/SQL/template paths; cluster stopped. No real AWS transport, real key, grants, resource change, production action or full P01 acceptance. Final strict types and review remain.

Next source work: review/correct this unit, then growth effect boundaries and operational scripts; actual preparation/review/execution/history UI+HTTP still required. Final HTTP delivery must preserve current recipient authority around outcome recording; these private modules are not a public delivery/installed/live acceptance claim. Keep P01 blocked and preserve all full-master scope.

### Local exact LinkedIn post publication

The default publisher no longer chooses the latest connected account. Pure preparation binds selected connection ID/revision, actual author, granted posting scope, expiry, full rendered payload/draft revision and REST version. No credential value participates in a digest or action/event record. Unadmitted/invented bindings refuse before credential lookup/decryption. Source metadata and current posting policy are rechecked in the final action transaction under shared draft/connection locks; unsupported growth effect profiles still refuse.

The final publisher sends once with redirect refusal/deadline and bounded successful response decoding. A real post URN is required; missing identity, transport loss or ambiguous recording remains explicit unknown, never a fabricated success/automatic resend. Provider confirmation is separate from local bookkeeping: conditional draft updates do not overwrite changed content, revoked connections are never restored, and a known remote result remains known if local recording fails. The durable platform record is authoritative. Caller-triggeredBy is a hint only; business attribution derives from the authenticated private binding. Raw provider bodies/errors are not stored or returned.

Tests: missing-plan/source assertions RED, five publisher tests initially RED, then20focused checks across5files GREEN, including preserved decryption-failure assertions now using admitted exact authority. Strict root types pass after fixing a test-only empty mock-call tuple with typed arguments (no cast/assertion weakening). Fourteen actual owned PostgreSQL cases PASS at `/private/tmp/axiom-platform-pg-65f50co7` (stopped):3new default publisher/source/unknown cases use real HMAC, real SQL and synthetic credential crypto with simulated HTTP. The generic ledger fixture now uses settings.vercel rather than a pretend growth source, because actual growth sends require real current draft/connection rows; new cases expressly test those rows. No provider account, real token/key, external post, flag or production change occurred.

Remaining growth work: image initialization/upload, delete/schedule effects, operational script/cron closure, cross-action native publication deduplication/recovery policy and complete prepare/review/execute/history workflow. Same binding cannot replay; do not infer cross-action native exactly-once coverage from that fact. The whole batch is not ready for a PR or P01 coverage. LinkedIn public API/source qualification and live response behavior remain separate; a new bounded public-documentation exception is requested, not assumed.
