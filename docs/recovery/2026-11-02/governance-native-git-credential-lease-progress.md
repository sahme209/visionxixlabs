# Native Git credential-lifetime ledger — approved local implementation

Design approved by the user: governance-native-git-credential-lifetime-proposal.md. Source is local only. No production credential, provider action, deployment, permission grant, schema change or independent human decision occurred.

## Actual issuance path

The native push HTTP handler captures current paired authority and installation, reserves a pending lease under the activation organization lock, rechecks current authority after reservation, resolves the existing pinned repository token once outside database locks with real provider expiry metadata, and finalizes the exact lease before exposing any credential. It then retains existing default-branch reads, best-effort secret-free audit and final current write guards. Clone/pull still use only contents_read and create no write leases. The existing github:write gate and operator behavior remain; no role expansion.

The shared token resolver now has an explicit expiry-bearing method. One shared actual issuance/cache path captures repository, pin, profile and signal before awaits, validates finite future provider expiry and rechecks installation after resolution. The legacy token-only method retains its exact result shape; missing expiry never acquires a guessed duration. No token, clone URL, credential payload or provider secret is stored in the lease ledger/audits/errors.

## Durable safety and uncertainty

Pending and issued records use existing durable workflow/event tables with strict immutable tenant/actor/session/repository/branch/installation/protocol/nonce binding and hash-linked history. Duplicate reservation nonce and finalization replay refuse instead of minting again. Reserve/finalize serialize positive unenrolled absence with current persisted authority, actual state change and final freshness. Provider work runs outside these transactions. Unknown provider or finalization acknowledgment never clears a pending lease or automatically remints. Known issued records retain exact provider expiry and original history.

Source review found a last-await session gap; real PostgreSQL regressions reproduced reserve and empty-history metadata reads surviving expiry during a later DB-clock wait. Issuer and reader authority now supply mandatory private freshness closures checked after the final database await. Actual locked membership/session/installation reads and current paired/commercial access remain separate from those closures; no public truth flag or serialized authority function exists.

Independent review found a second session gap at the final credential response. The read route and shared GitHub write guard now retain exact session expiry through the final SQL result await and check it synchronously before returning a bearer. The guard also retains cancellation/monotonic deadline and clears freshness on every start/failure. Root's read regression was RED200vs409 before correction; delayed actual PostgreSQL clone/push cases first ran GREEN on corrected code and are not presented as a fabricated PG RED. An expired-session push keeps its issued lease even when the response is withheld.

## Metadata and explicit remaining boundary

The metadata blocker reader holds the organization lock, validates each immutable history and pages100 records at a time, with a15second/10000-record hard refusal ceiling. Overflow returns unavailable, never partial counts, deletes or a false absence. Pending records never time out into safety. Exact issued expiry is compared to the database clock. Every result retains legacyQualification:unavailable, including an empty ledger.

This ledger does NOT qualify older untracked bearers, mixed/older issuer runtimes, branch-level token restriction, or full Governance coverage. Production coverage remains empty and activation refuses. A separately concrete rollout/drain plus provider-backed legacy expiry/revocation/installation-generation proof and full registered mutation manifest/customer enrollment workflow remain necessary. No guessed grace period, SQL backfill, checkbox acknowledgment or legacy authorization issuer was added.

## Evidence and reproduction

-22 store unit tests and12 actual socket-only PostgreSQL journeys pass: both organization-lock orders, overlapping cached-token leases, exact long-known expiry, duplicate nonce, role/installation/session changes, cancellation/provider/session expiry rollback and malformed history. The two real session-wait regressions failed before the private-closure fix.
-38 locked authority unit tests and8 actual PostgreSQL journeys pass, including installation insertion during the final auth await, lock-wait expiry and expiry retained through later caller awaits. Pairing/commercial auth is explicitly simulated; network fetch forbidden.
-67 resolver/profile-cache/bounded-auth/shared-guard checks pass.37 route orchestration checks pass.92 focused shared-GitHub guard/direct-route checks pass after final expiry retention. Batches overlap and are not summed as unique evidence.
-10 actual Next-handler/store/authority/resolver PostgreSQL journeys pass, including committed pending-before-mint observed by a separate connection, org/row NOWAIT during provider work, known expiry committed before audit/response, zero-mint reservation refusal, unknown pending, issued commit with lost finalization acknowledgment and no remint, final current-source/session loss, read-only clone/pull and real-clock delayed final-response expiry. Authentication, lower provider issuer/default-branch GET and audit are simulated. No live issuer or provider acceptance claim.
-All owned PostgreSQL servers stopped. Narrow types/whitespace checks pass. Final supported Node24 whole project passes1367suites/16077tests,75suites/582tests skipped (not execution evidence), zero failures. Exact runtime3b26e4bb production archive build/Next TypeScript pass:5872 verified regular files, SHA2a708c5c6e5ba4b62ad0f5b0094fb34a08bcee51d97cf0c84d03539db24f6523. Receipts native-git-lease-project-tests.json and native-git-lease-production-build.json. No native frontend change/rebuild/relaunch or new visual acceptance is claimed.

Reproduce only on fresh owned fixtures: scripts/run-native-git-credential-lease-postgres.py, scripts/run-native-git-credential-authority-postgres.py and scripts/run-native-git-credential-http-postgres.py. These are byte-identical copies of the executed private-socket harnesses and stop their servers in finally. No customer database or existing backup is selected.
