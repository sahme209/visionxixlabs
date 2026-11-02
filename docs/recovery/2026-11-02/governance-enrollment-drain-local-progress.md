# Approved enrollment-drain implementation — local foundation

Runtime source: `18c7cff926b16d251a25e8f68603b678916b28db`. The user explicitly approved local implementation of governance-enrollment-drain-proposal.md. No deployment, schema migration, real credential, provider access, role/grant, production setting, human decision or enrollment activation occurred.

## Implemented

Strict versioned begin/abort plans require the current administrator requester to be the original executor and a genuinely separate independently recorded reviewer. The store owns preparation, approval and one-attempt consumption; a copied approval DTO grants nothing. Actual request authority re-resolves the current paired/commercial caller and locks exact original participants, memberships and sessions. Private expiry/cancellation/reversal/deadline checks survive later DB and transaction-result awaits.

An organization-first durable barrier and hash-linked history serialize new reservations with begin-drain. Prebarrier slots carry a store-derived null epoch; later epochs cannot hide any tenant history. Historical epoch reuse, not only immediate reuse, refuses before consuming a decision. Abort has a fresh separate exact approval, restores only the bound prior state and preserves active-policy/history constraints. Pending, submitted and unknown slots block indefinitely; cancellation, elapsed leases and acknowledgments do not silently clear them. No activation method or runtime qualification issuer is supplied.

Intent freshness is published only after commit and successful retained checks as a private one-use function, never a serialized permission. The two existing fixed transports now have an optional trusted beforeSubmission hook invoked exactly once for actual PUT/POST, never for current-authority/readback callbacks. Malformed configured returns refuse; intent proof and original authority are checked immediately before fetch. These are preparatory seams, not durable caller integration.

Current accepted same-organization readers can deliberately recover exact saved decision/slot/transition history, without provider/source reads, events, consumption, deadline renewal or retry. Only a genuine supported exact terminal/no-future-effect verifier permits a reader to record quiescence after the original session expires. Original immutable bindings remain; the actual observer is recorded. Submission/unknown transitions retain original ownership. Missing verifiers refuse. No production candidate/manifest, operation or quiescence verifier is installed.

## Verification

- Supported Node24 whole project:1374 passing suites /16205 passing tests;79 suites /631 tests skipped; zero failures. Skips are not actual database execution.
- Drain store:15 unit checks pass; all11 actual PostgreSQL cases pass on the exact final source, no skips. This final run follows genuine RED/fixes for historical epoch ABA, corrupt deterministic barrier tenant, current-reader recovery and strict saved-history lookup. It covers both organization-lock race orders, cancellation rollback, consumed-after-commit session expiry, private one-use intent expiry, unknown blocking, separate abort and preserved histories.
- Authority factory:11 unit checks and5 actual PostgreSQL cases pass. Caller authentication/commercial, candidate/source/provider qualification are simulated; actual stored roles/sessions/clocks/locks/history are exercised. All owned fixtures stopped.
- Transport hooks: genuine10-failure RED followed by49 passing affected tests (includes existing tests; overlap with whole suite).
- Scoped types and independent source reviews pass. Final source reviewers found no remaining important findings after epoch, tenant-corruption, observer and recovery corrections.
- Exact clean-source production build and Next TypeScript pass on5921 verified files, archiveSHA3da4d272781a3170b4c238f4f080abc9c8eeb53dba366ea4288d620d8e1ac9bb; enrollment-drain-production-build.json binds source/stage. No frontend/native changes or new visual/live acceptance inferred.

Reproduce actual PG with scripts/run-governance-enrollment-drain-postgres.py and scripts/run-governance-enrollment-drain-authority-postgres.py. Raw final store log /private/tmp/axiom-drain-final-pg.log (11pass); authority /private/tmp/axiom-drain-authority-pg.log (5pass). Earlier observer-specific RED/GREEN and unit logs are /private/tmp/axiom-drain-observer{-red,-pg-red,-pg-green}.log, /private/tmp/axiom-drain-recovery-read-red.log, /private/tmp/axiom-drain-green.log. Main suite/build receipts are separate JSON files.

## Mandatory next integration gates

This does **not** complete Governance. Every actual applicable caller must reserve before credential issuance and carry a one-use intent to the real transport. Merge/deployment preflight already mints write tokens before claim, so dispatch-only slots are insufficient. Credential exposure, accepted asynchronous provider jobs and downstream applicable effects need separate exact supported observation/expiry/quiescence profiles. Fleet/control-plane and provider-backed legacy qualification cannot be replaced by a new empty ledger, generic true port, static hash, self-reported heartbeat or guessed grace period.

Complete source-qualified manifest/admission, actual source/candidate/operation/quiescence verification, mixed-runtime/legacy proof, atomic baseline activation, native policy/drain/recovery workflow and genuine/live acceptance remain. Production readExecutionCoverage is still empty and activate refuses. Detailed source wiring order is governance-drain-integration-gates.md. No adapter is silently enabled.

The full A1–A9/B1–B6 master remains active. ServiceNow's already-written unknown note is never resent/reset/renewed; fresh genuine observation/native Normal-New policy/lifecycle/closure remain. Deferred Store/Windows, v122/publication, integration backlog, original website/authentic media/approved documentation/support knowledge and A9 migration/offline acceptance remain. Documentation revisions1–3 are preserved; revision3 binds4fb99c78 and changed transport source now requires a new reviewed revision before current-source/customer eligibility. No unsupported security/completion claim.
