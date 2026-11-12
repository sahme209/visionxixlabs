# PR 321 second CI round — unresolved

Candidate `741a230a` fixes missing emitted clients; the actual auth-recovery rehearsal now passes. Type checking and production high-severity audit also pass. Other jobs are tracked on the PR; no merge is authorized while any applicable job fails/pends.

## AWS isolated enrollment failure reproduced locally

CI job `130853264831` reaches the actual serializable last-slot rehearsal but fails its assertion that the loser exposes P2034 or SQLSTATE 40001. Fresh owned local PostgreSQL reproduces exactly that assertion. A separate diagnostic copy (not committed or used for acceptance) shows the losing raw SQL operation throws `DriverAdapterError`, message `TransactionWriteConflict`, with neither top-level `code` nor `meta`. Installed adapter source maps PostgreSQL 40001 and 40P01 to that exact cause kind. The schema/data/transaction assertion must remain; do not accept arbitrary rejections or remove the exactly-one-commit check.

The model-operation concurrency test already passed as P2034, so that narrower proof did not establish raw-SQL conflict-code compatibility. Next: inspect the actual cause and existing production conflict classifiers, preserve legacy and modern abort semantics through a source-reviewed compatibility mechanism, and test actual raw-SQL concurrency. Do not merely make the rehearsal accept any error or claim existing production retry handlers are compatible. No production/provider request occurred. Each diagnostic used a fresh owned local cluster; the diagnostic shell stops that owned server on exit. Files are preserved.

## HTTP acceptance failure

CI job `130853264650` reaches application HTTP acceptance but fails `isolated_next_start_failed` while waiting for the CSRF endpoint. Its existing harness captures stdout/stderr to `/tmp/axiom-isolated-next-http.log`, but the workflow currently does not return that file. Root cause remains unconfirmed. Do not increase the timeout, suppress startup failures or call it a Prisma problem without evidence. Next: reproduce the exact guarded child startup locally or add bounded fixed-category failure observations, retaining the current child environment and no-credential/no-provider guards.

Local full suite/build results are preserved but do not substitute for these actual opt-in CI gates. The PR remains open and production unchanged.

## Local correction and remaining startup diagnosis

A pure own-data error-code reader now recognizes the exact bare adapter conflict and the actual Prisma P2010 wrapper's `meta.driverAdapterError` conflict. It preserves every other existing code, refuses accessors/inherited/malformed evidence, and performs no retry or IO. Nine existing P2034 classifiers reuse it without changing their transaction bodies, retry counts, requester authority or provider dispatch. The AWS rehearsal and legacy admission classifier reuse the same reader; arbitrary rejections still fail. The nested-wrapper unit first failed, then passed after the source-reviewed narrow exception.

Actual fresh owned PG tests now pass all four cases (including raw SQL one-commit/one-recognized-abort). The complete actual AWS enrollment/revocation rehearsal also passes, including distinct last-slot accounts, foreign tenant refusal, challenge consumption, revocation rollback and exactly one serializable commit. Local servers stopped after each run; no existing cluster/database/provider was used or altered.

A local exact HTTP startup probe was refused by the unchanged managed launch policy before any child launched. That is not evidence of the CI root cause and was not bypassed. Instead, source-reviewed bounded readers now emit fixed failure-category labels from the already captured synthetic HTTP/runtime logs in CI. No raw logs, error text, paths, environment values or credentials are returned. Optional invalid logs remain unavailable and do not weaken required receipt/image/cleanup acceptance. Both readers use nonblocking/no-follow opens; an actual owned FIFO regression confirms bounded refusal. Six Node tests and the collector's existing private-input/security assertions pass. Startup root cause remains unconfirmed until the new observation executes in CI. No timeout increase, fake success, disabled test or guard weakening.

## Third CI observation

On `04e22752`, the actual AWS enrollment CI now passes, alongside required Typecheck + Vitest, production/offline build and the observed desktop/frontend checks. Both HTTP and website failure observers return only `module_missing`; the website still fails with owned cleanup confirmed. This narrows the cause to module loading but does not identify the missing module. Independent source inspection found no supported exact missing specifier or justified fix. A finite whitelist of public Prisma/internal/preload module tokens and Next output path families is added to the bounded classifier; it emits static labels only, never captured tokens. Seven Node tests pass, including secret non-disclosure and real FIFO refusal. Unknown requests remain unknown; no startup success or timeout/guard change is claimed.
