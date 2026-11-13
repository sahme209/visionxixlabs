# Joined time — workload and operational human-session integration

Local implementation under `call_89eb4532167a4e55b4c65c38f8fe44cc`; full approved scope is still in progress. No real SQL, GitHub identity/provider, native clock, credentials, resources, deployment or enablement occurred.

## Workload identity

The actual signed JWT verifier now receives an explicit private time source and controlling signal. It retains JOSE signature/key/issuer/audience/current-profile/run checks and existing database-time checks. The whole interval additionally must satisfy iat/nbf, token expiry and the shorter original action deadline. Current profile is reread after the awaited interval; cancellation refuses. validFrom is held only in the existing private WeakMaps, not added to persisted records or returned identity metadata.

One-use consume still deletes the original proof before awaited checks, reserves the original JTI through the actual transaction port, then repeats currentness. Expiry after reservation cannot restore either the proof or replay admission. Default unregistered composition passes its existing unavailable source as the clock and the actual request signal; there is no process-clock fallback.

## Operational human sessions

The private SQL principal reader now includes conservative millisecond lifetime bounds: ceil of issued-at and floor of expiry. This uses existing columns and preserves shared row locks, joins and the original database-live predicate. No schema/migration/storage field or production query was added/executed. The legacy authority row parser permits these optional metadata fields, preserving existing nonsecret history readers.

The operational execution runner additionally requires exact current principal/session, database-live status and both recorded lifetime bounds through principalTime. Missing values refuse rather than borrowing the database's point timestamp. The original permission checker runs both before and after this time check inside the original transaction. This does not issue a role/session or qualify a time source. Other platform-family authority composition and the actual shared native profile remain unfinished.

## Evidence and limits

- Five new workload cases first failed against the original verifier despite actual synthetic JWT signing/verification: lower/upper interval overlap, proof expiry, profile revocation during clock read and request cancellation. After implementation,42workload checks pass, including additional reservation-after-await/no-replay and shorter-action-deadline tests.
- Four session-time checks pass with synthetic locked-reader input. The first RED was a missing module; an initial positive case then exposed inherited strict parsing of the extra email field, corrected by stripping only unused fields in this additional time reader. The original authority checker still validates the email/allowlist and current role/session rules.
-53focused checks across workload identity, session time, existing authority and runner pass. Counts overlap prior suites; they are not53new independent journeys.
- Root strict native types pass. Full ordinary suite:18,948passed,0failed,1,142pending,20,090total;0failed suites. `work/joined-identity-vitest.json` is the local report. Existing Vite configuration warning remains.
- Independent source review found no important issue in the implementation slice; the last two added tests changed no implementation. No reviewer execution/provider/SQL verification is claimed.
- Actual PostgreSQL opt-ins remain skipped. Their fixtures now supply explicit synthetic clock inputs, but the amended SELECT syntax, actual timestamp rounding/row-lock behavior and joined real-store execution have NOT been accepted by running them. No production build or native package was produced for this change.

## Continue the full goal

Complete time-aware source acquisition, template/image/post/schedule/manual paths, native closure and the complete transitive caller/signing review. Qualify that the actual runtime uses the same protected time/profile source consistently; injected synthetic clocks do not establish this. Then obtain exact real database/runtime/source/fleet/custody/human/provider qualification and required build/PR/production approvals. Preserve original ServiceNow unknown-written history and every remaining master requirement. Full Governance stays incomplete and disabled.
