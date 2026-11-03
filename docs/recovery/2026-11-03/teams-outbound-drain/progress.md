# Teams exact-message outbound adoption — local only

The actual connected-action HTTP execution path now uses the durable outbound drain for the single Teams channel-message profile. The canonical issuer remains unavailable, so production composition refuses before claim and before execute-only target discovery. This is not coverage, fleet qualification, or Governance activation.

The DB-only claimed reader retains actual current executor/session authority (including legitimate re-pair), original independent approver/session, exact intent/history/attempt-one user-ID lease, live connection/target, and saved-task binding. Under the same organization lock it refuses any Governance enrollment metadata because this profile is still uncovered. It captures the discovery snapshot by value and bounds private freshness by original lease, intent, approval and session deadlines with conservative pre-await clock accounting.

The slot is durably reserved before postclaim credential access. The fixed transport records one submission intent and consumes private current-authority and postcommit intent proofs synchronously before its single POST. Current transport cancellation is forwarded through the credential callback and checked after connection read, before plaintext decrypt. Lost reservation or submission acknowledgements stay blocking; no resend, reset, quiescence or accepted-provider-job inference is introduced.

Preclaim discovery still decrypts an existing persisted write-capable OAuth bearer for read-only target discovery. This does not mint a new token, and its previous plaintext lifetime is not qualified by this change. Linear retains its prior transport behavior and is not newly covered.

## Verification

- Corrected focused batch: 45 tests in 7 files, pass. Provider, current authority and positive issuer are simulated in these unit/composition tests.
- Corrected actual-source scoped TypeScript: pass. Initial narrowing errors retained in scoped-types.log; no broad build performed.
- Initial owned isolated PostgreSQL run: 6 pass, 4 filtered; root stopped fixture. Real stores, transactions, task rows and session/approval locks; provider, request authorization and positive issuer simulated.
- Independent review found an enrollment refusal dropped at the final Teams path and an ignored shorter credential signal. Actual enrollment-after-claim regression reproduced confirmed instead of refused (RED); callback regression reproduced the wrong signal (RED). Both logs retained. Corrected source reviewed with no remaining important findings.
- Final root-owned isolated PostgreSQL correction: 2 pass, 9 filtered (new enrollment negative plus repeated normal positive), fixture stopped. Across both passing runs there are 7 distinct cases, not a single 7-case green run. See final-result.json and pg-corrected.log.

No customer/provider requests, real credentials, schema migration, rollout, flags, permission grant, spending, or coverage activation occurred.
