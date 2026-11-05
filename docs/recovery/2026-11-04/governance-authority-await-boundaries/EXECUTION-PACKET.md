# Governance authority awaited-boundary verification

1. Outcome: verify the existing private authority cannot return success after paired identity changes, revocation or request cancellation during awaited checks.
2. Owner/dependencies: root authors focused regression tests; adapter independently reviews. Existing Vitest and real requestAuthorityCore only; no dependency adoption.
3. Baseline: a9283114; no concrete defect found in bounded private-merge source audit. Canonical supplier/issuer gate remains closed and pending909 experiment untouched.
4. Changes/non-goals: new test-only cases for initial-resolution cancellation, final-resolution cancellation, final principal drift, final credential-kind drift and final resolver refusal. No new authority boundary/runtime fix, SDK, DB schema, native or provider implementation.
5. Boundaries: fake paired resolver and transaction reads, real existing core; no actual session/database/provider/Keychain/credentials. Network denied and writes confined to owned test cache/temp; empty envDir and scrubbed process environment.
6. Acceptance: deliberately controlled await points; outcomes refuse with no authority success, exact transaction/resolver invocation counts, plus one positive exact-current principal path. Run only new file, not prior passing suites.
7. Proof: isolated simulated authority behavior only; not genuine paired identity, real-store locks, compiled issuer, successful merge or Governance activation.
8. Recovery: reversible new test/evidence files; only owned temporary test state; no DB/service/resource to undo.
9. Spend/approval: zero external spend and existing approved local Governance code/test scope. No experiment909, live discovery, deployment, flags, grants or provider action.
10. Evidence/next: preserve test command/config/profile/log/result/source hashes and independent review; leave full custody/fleet/coverage/enrollment/live gates open.
