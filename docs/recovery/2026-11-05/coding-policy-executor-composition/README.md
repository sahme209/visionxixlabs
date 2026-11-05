# Actual coding proposal function — policy and accounting composition

Two new actual owned-PostgreSQL journeys pass, with zero failures or skipped cases. Scoped transitive types pass. This continues the approved local workspace-policy repair without changing runtime source, deploying or spending. Earlier passing suites were not selected again.

## Numbered verified checklist

1. ~~Actual `codeProposeRealExecutor` proposal branch~~ receives a fresh real stage claim and valid fixture metadata. Its own credit check, policy loading, message preparation, fixed-hold admission, manager/Gateway/installed SDK, proposal parsing and durable usage readback run. The synthetic final response contains a valid new-file unified diff. The function returns that parsed proposal with recorded/pending accounting, backed by one usage row linked to both pending ledgers. Repeating the same execution context produces no second SDK fetch.
2. ~~Actual policy-change schedule during claim~~ uses a separate owned PostgreSQL transaction holding the exact workspace policy row `FOR UPDATE`. The test observes a newly committed reserved hold and one policy `FOR SHARE` lock wait through `pg_stat_activity`, scoped to the fresh owned database and role. It then commits `enabled=false`. The actual executor refuses, performs no SDK fetch or usage write, and leaves both reservations reserved and unclaimed. The bounded test releases and drains its writer and executor even on setup failure.
3. ~~Isolation, source binding and shutdown~~ retain the previously reviewed fresh private socket-only PG runner. Packet `1a1b040c…` matches after execution; the owned server reports no server running. No old or expired fixture, recovery SQL, shared/customer database or additional role/grant was used. Raw log bytes are preserved losslessly as base64 JSON.
4. ~~Independent source/result review~~ is recorded separately in `preparation-review.json` and `final-review.json`.

## Synthetic boundaries and remaining acceptance

The final fetch is installed before SDK imports, initially rejects everything and only accepts the exact synthetic Gateway URL without forwarding. Credentials and model output are synthetic. Private database wiring points only to the owned fixture. Audit persistence is explicitly stubbed; these tests do not establish an audit-record acceptance result. Financial/policy/claim/usage primitives and the proposal function are not mocked.

The lock witness is a finite one-claim fixture, not every possible schedule. Its query identifies the owned database/user and policy `FOR SHARE` statement, not an organization parameter. A refusal may involve serializable conflict; the result does not isolate a single SQL predicate or establish physical-wire atomicity.

This verifies the actual proposal function's successful no-refinement branch and one policy-race refusal. It does not qualify the whole queue/worker pipeline, every refinement or budget variant, real authentication/model behavior, patch application, a GitHub write, final settlement, quoted text, native/human approvals, fleet/resource custody or full Governance. Returning a patch string is not installing or releasing a patch. All 21 master parents and production activation gates remain open.

Runtime base is `6c8f87f5` (runtime code unchanged from `f84719d4`). See exact tests/runner bindings in `source.json`, scoped `types.json`, `receipt.json`, `results.json`, cleanup logs and final review.
