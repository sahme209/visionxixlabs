# Linear update and state-transition outbound adoption — local only

Two existing saved action profiles now mount the durable outbound protocol: Linear issue update and the existing close transition to an exact completed state. One internal adapter supplies two fixed factories, and the current shared claimed reader has separate exact-kind wrappers. No new action, provider scope, role or issuer authority is added. The canonical issuer always refuses before execute-only discovery or claim.

The original saved issue, team, optional completed-state ID and target evidence are retained in the target binding; full reviewed title/description/state payload is retained in the source binding. Existing provider discovery and receipt validation are unchanged. Current executor/re-pair session, original independent approver/session, saved-task revision, connection, original one-attempt lease, source discovery window and fail-closed enrollment absence are checked under the original organization-first transaction. The private synchronous proof cannot renew the captured source deadline.

Reservation precedes postclaim credential resolution. Submission intent commits before the sole fixed GraphQL mutation POST; current-authority and postcommit intent proofs run synchronously at the fetch edge. Transport cancellation still reaches the callback and is checked after connection read before decryption. Lost acknowledgements remain blocking unknown/refused records; no automatic resend, reset or quiescence is added.

Discovery GraphQL POST queries remain reads. The persisted write-capable bearer is not newly minted, and its earlier lifetime remains unqualified. Existing provider checks do not supply a provider-side atomic compare-and-swap guarantee; the integration does not promise isolation from changes after the last observation. This is not executing-identity proof, fleet qualification, coverage enrollment or Governance activation.

## Verification

- Eleven focused files: 71 tests pass, including the two profile adapter cases and prior create/Teams/transport/store/HTTP regressions. Positive issuer, request authority and provider responses are simulated.
- Actual-source scoped TypeScript: pass. No broad build or provider access.
- Root-owned actual isolated PostgreSQL: 18 pass, 16 filtered (16 new change cases plus create and Teams positive regressions); fixture stopped. Eight cases per profile: positive, lost mutation acknowledgement, canonical refusal, changed issue evidence before claim, lost reservation acknowledgement, enrollment after claim, current-session re-pair and task revision after claim. See actual-pg.log.
- After the fixed factories were made runtime-extra-argument safe, two targeted adversarial tests pass with 16 filtered, proving that an opposite-kind extra argument cannot select the other profile or create a slot. Reported separately from the initial 71-test run.
- Independent frozen source review: pass, no important findings.

No real provider request, deployment, schema migration, production flag, permission grant, new credential or spending occurred.
