# Platform Governance local progress

## November12 — platform Governance initial local implementation

Owner approved the platform design for local code/schema definitions/isolated tests. Exact effect contracts and pure plan/review/claim/terminal transitions now pass9tests; transactional action/child-effect service passes7in-memory checks. Three actual isolated PostgreSQL journeys prove one concurrent claim, event rollback and terminal unknown preservation; server stopped. Root strict types pass. Dedicated platform tables are proposed only; no production migration, current-auth default, provider transport, workflow/UI or full P01 coverage is complete. P01 remains blocked. Source plan: `docs/superpowers/plans/2026-11-12-platform-governance.md`.

Actual SQL receipt: `/private/tmp/axiom-platform-pg-1rgnloqn/receipt.json`, result3passed/0failed/0pending; authority supplied by test ports, not real users. Source hashes bind the tested files only. No actual provider dispatch.

Logs: `/private/tmp/axiom-platform-kernel-red.log`, `axiom-platform-kernel-green.log`, `axiom-platform-store-red.log`, `axiom-platform-store-green.log`, `axiom-platform-sql-red.log`, `axiom-platform-types1.log` (captured narrowing error), `axiom-platform-types2.log` (pass). The post-SQL source change only narrows an existing non-null observation binding; no transaction semantics changed. Final source review is pending.

### Current platform authority source — local only

Current authority now joins real User, DesktopSessionRecord and accepted OrgMembership columns under shared row locks, checks DB-time session issuance/expiry/revocation, and re-reads the deployment-admin allowlist after awaited lookup. The pairing workspace only validates session membership; it never owns the platform action or grants platform privilege. Three pure/injected authority checks pass after missing-module RED. Five actual isolated-PG tests pass (the prior3 plus2 using actual identity/session/membership SQL); token possession/authentication and provider behavior are not simulated as real acceptance. Fixture `/private/tmp/axiom-platform-pg-41cd3qqp` is stopped. Strict root types pass.

Next: bind actual authenticated request possession to this reader and the service; then mount final effect boundaries/workflow, complete source review/whole validation. Existing NextAuth JWT alone has no durable per-session revocation row, so it must not be relabeled as one. No route/provider/cron allow path or P01 readiness is enabled. Identity fixture represents only the exact consumed SQL columns, not full production-schema qualification.

Independent review of f222f861..d6dff148 found no important issues. It explicitly confirms stored current authority is not proof of requesting-session possession; that request boundary is next. Current master/handoff/goal entry points now reflect merged offline source and the resolved platform scope without removing dated evidence. Timestamped copies retained under ignored work/. No product/test/runtime behavior changed in this synchronization.

### Request possession and final effect authorization

Private default request composition now verifies the existing desktop-token HMAC before database lookup, derives stable identity from the real paired-session row, and joins current platform authority. No caller-supplied actor, API-key/cookie/cron fallback, heartbeat or membership self-heal is introduced. Possession is rechecked around awaited authority reads and cannot switch to another session after binding. The existing signing-key selection is reused unchanged; tests use only an ephemeral synthetic key, never a real credential.

A separate one-use final-effect check binds exact target/effect/requester and rechecks both humans and expiry after claim. Confirmation without that final authorization now refuses; a consumed or failed authorization is never restored. This is prepared source for the eventual transport, not proof that existing provider helpers enforce it yet.

Actual request-source missing-module RED and final-effect behavioral RED4fail/6pass preceded implementation.27focused kernel/store/authority/request checks pass. Seven actual fresh isolated-PG cases pass, including2 through the default request factory with actual HMAC verification and real SQL; synthetic users/key and no provider transport. Latest fixture `/private/tmp/axiom-platform-pg-1fu7iugt` stopped; prior accepted fixture `/private/tmp/axiom-platform-pg-cekt2i6s` also stopped. No real sign-in, credentials, HTTP route registration, live provider, schema apply, deploy or P01/full-Governance acceptance.

Next: final source review/types, then exact effect-adapter/caller coverage and complete workflow. Dedicated proposed tables still have no production migration, and historical schema pins have not been renewed.

### Independent final-send race correction

Review of766ecbf1 found that concurrent unknown/refused observation could consume a proof while beforeEffectSend waited, yet admission could still return permission. A deferred-authority regression actually failed1/11 (ten controls passed). The final gate now rechecks that the identical private binding remains owned after transaction completion and immediately before granting; consumed bindings refuse. GREEN28focused checks across4files, including both unknown/refused schedules. No provider execution or claim reset. A strict test-fixture discriminant narrowing also fixed a TypeScript-only union-spread error without casts/relaxed assertions. Final strict types and re-review are being completed.
