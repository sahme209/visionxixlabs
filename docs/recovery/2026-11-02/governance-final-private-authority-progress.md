# Private authority at actual dispatch — local qualification

Runtime source: `4fb99c78e9eec08e343f69347f72eb95feae4ec2`. Local code and isolated tests only; no production deployment, real credential issuance, provider write, role/permission change, schema migration or human decision occurred.

## Implemented

The deployment factory now re-reads and locks the canonical independent approval before deriving its original reviewer session. Both the requester’s current session and the original reviewer session retain private expiry/revocation qualifications across the final approval and transaction-result awaits. An execution-row copy cannot substitute another session.

Both actual merge and deployment stores publish the combined private freshness closure only after their final transaction resolves and passes. Governed and positive-unenrolled legacy compositions require that publisher; an obsolete store that omits it refuses. The actual fixed-host transports retain the function across asynchronous helper delivery and invoke it synchronously immediately before the provider request. Deployment prepares request options and evaluates its compatibility callback before this last check. The function is not a serialized authority field, permission flag or provider payload. No-write refusals stay refused; dispatched ambiguity stays unknown; consumed attempts are never reset or retried.

## Evidence and limits

- Full supported Node24 project: **1371 passing suites / 16164 passing tests**, 76 suites / 611 tests skipped; zero failures. Source runtime was unchanged during this run; four tracked reproduction scripts and A9 design documents were committed with it. `final-private-authority-project-tests.json` records the raw log.
- Deployment original-session batch:79 focused unit tests and4 actual isolated PostgreSQL expiry journeys pass; the latter reproduce expiry during approval and after transaction commit while plan/numeric/provider windows remain valid.
- Genuine outside-helper deployment RED: the real fused helper committed and returned a valid private proof, then its caller delayed only delivery5.1seconds; old transport POSTed despite exact provider-proof expiry. The corrected path passes1 PostgreSQL case with zeroPOST. Separately, actual mounted HTTP/service enrolled and custom-environment legacy positive cases pass2cases with one dispatch each.
- Merge transport:55 focused checks and21 actual PostgreSQL cases pass. The final microtask expiry tests use a simulated clock installed before provider-factory creation; they are not described as actual elapsed waits. Earlier actual elapsed transaction tests remain separately recorded.
- Final actual merge coordinator5 PostgreSQL cases pass once after the root legacy update: positive custom scope makes onePUT and replay does not make another; all negative cases withhold it.
- Root publisher wrappers31 merge +22 deployment checks and deployment transport22 checks pass (overlap with whole suite; do not sum). Review's last-callback ordering issue has its own genuine RED then GREEN logs.
- Independent source reviews found no remaining important findings. All owned PostgreSQL fixtures stopped. Pairing/authentication/provider responses and coverage activation in fixtures are **simulated**, not genuine human review or live acceptance.

Reproduction scripts: `scripts/run-governance-deployment-original-session-postgres.py`, `scripts/run-governance-deployment-final-transport-postgres.py`, `scripts/run-governance-deployment-positive-composition-postgres.py`, `scripts/run-governance-merge-final-transport-postgres.py`, and the existing coordinator harness. These create and stop isolated local databases; no production database recovery/migration or provider call is involved.

## Still incomplete

Production `readExecutionCoverage` remains empty and activation refuses. Complete trusted mutation classification/coverage, in-flight quiescence/drain and legacy/mixed-runtime bearer qualification, enrollment and the native source/proposal/exact independent review/activation/drift/recovery workflow still require implementation and acceptance. Empty new ledgers never prove older tokens absent. This increment does not complete Governance or the full master.

A9 foundations now have a48-source-hash dependency inventory and a versioned orchestrator contract design. Airflow migration, Temporal/custom implementations and real disconnected deployment remain unimplemented. Existing Airflow continues unchanged.

All other A1–A9/B1–B6 gates remain, including genuine ServiceNow observation/native lifecycle/exact closure, deferred Store/Windows, release/website publishing permissions, authentic demos and approved supported-version documentation. The already-written unknown ServiceNow note is never resent/reset/renewed. Existing provider/database/security/spending boundaries remain.

Exact clean-source production build and Next TypeScript passed on5898 verified archive files (archive SHA74ab3feeb8a6d93a30073feb7570d57b6137653e567b8332ee3067a8ce6cc995). Stage/private/tmp/axiom-deployment-baseline-production-dbpvvak2 and final-private-authority-production-build.json bind the source. No frontend/native code changed; no app rebuild, relaunch or visual acceptance is inferred.
