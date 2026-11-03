# Real merge outbound adoption — local implementation report

Implementation source is frozen for review and root-owned PostgreSQL verification. No commit, provider operation, deployment, flag/schema change, actual issuer launch or activation performed by this agent.

## Scope and authority

The user-approved enrollment-drain design already includes exact outbound reserve/intent, canonical issuer binding, retained postcommit authority and no automatic quiescence. The preceding audit wrongly postponed implementing all such wiring merely because positive issuer qualification is pending. This source increment implements that actual coordinator path now. It does NOT supply the pending identity: the new typed internal canonical extractor always rejects under the existing public unavailable reader; there is no structural future-status acceptance, initializer, caller digest/flag or positive production test port. Explicit simulated source tests mock only that internal module.

Current source intentionally rejects mutation before claim when the executing issuer is unavailable. This is a local behavior change, NOT production compatibility or permission to deploy. Normal preparation/read-only saved recovery remain as before. Production coverage remains empty and activation unavailable.

## Exact implementation

- Merge coordinator constructs the real adapter for every mutation branch (enrolled and legacy), checks canonical availability before any claim/approval consumption, calls reservation before its original credential-exposure routine, and installs the adapter's actual fixed-transport beforeSubmission hook. Read-only eligibility remains separate. All branches must register pre-enrollment outbound work for a future drain to be honest; no legacy bypass is introduced.
- Enrollment drain store preserves its original SLOT format/history and generic reserve. New reserveAttempt finds the operation association under the org-first lock (bounded two-row query, ambiguity refuses), generates server UUID and persists canonical SLOT+event atomically. Any existing attempt, including reserved/unknown/terminal, refuses reservation; no remint/reset/replay. readAttempt performs current read-only exact association recovery from canonical immutable history; no process cache supplies association authority.
- Original merge execution row/state/versions are untouched by association. Shared DB-only claimed helper derives attempt/target/source/connection identifiers from the actual dispatching one-attempt record and retains original requester/reviewer/session/approval/window authority. Exact leaseOwner==operation.id is required.
- Adapter retains only one original request/plan/signal/issuer reservation promise, preventing automatic retry after lost ack. Physical submission resolves the association from durable storage, verifies exact original scope/binding, records intent and returns only the store's private one-use committed freshness. No provider I/O occurs under locks. Confirmed or unknown HTTP does not mark quiescent; intent/reservation remains blocking. No quiescence or drain-start verifier is installed.

## Focused evidence

- Persistence RED: 18pass/1fail because reserveAttempt absent; persistence GREEN19pass. Logs persistence-red.log, persistence-green.log.
- Initial adapter8pass and coordinator22pass were intermediate source tests, not final acceptance. New adapter tests were written after initial implementation; no initial adapter behavioral RED is claimed.
- Independent review identified unavailable canonical identity consuming original attempt, and noncanonical leaseOwner accepted. Lease-owner actual behavioral RED1fail31skipped saved lease-owner-red.log. Root-owned actual canonical-negative PG RED reproduced consumed refused attempt instead of untouched prepared; root owns its receipt.
- Batched corrections: availability before claim and exact owner. Final relevant four non-PG files62passed,0failed/skipped in final-focused.log (adapter7, actual canonical1, store32, coordinator22). These overlap earlier results; do not sum prior runs. Fixed mock-repo lost-ack callback now executes after simulated commit rather than inside rollback catch.
- Root initially ran actual PostgreSQL11passing journeys before the preclaim correction; this is intermediate only, with one now-corrected expectation. Root verified the final targeted changed canonical-negative, positive normal path and new actual committed-reservation-lost-ack case:3passed/9filtered; server stopped. Positive runtime identity, signing, sessions/auth and provider remain explicitly SIMULATED; real storage/transactions/history and independent-lock acquisition are actual.
- Scoped TypeScript command/config/include list recorded types-command.json. Process45007/PID71912 was still advancing cold AWS EC2 declaration reads at last observation; no result claimed here. Root can update final receipt after terminal completion.

## Remaining qualifications

Actual sealed canonical pre-import launch and same-artifact compiled consumer; other mutation/credential coverage; fleet/legacy qualification; supported provider-effect quiescence; reviewed drain/enrollment/native workflow and authorized live acceptance remain missing. This increment is actual source composition and local protocol qualification only, not full Governance, executing identity or activation.
