# AWS SDK upgrade review — November 11, 2026

Implementation PR #315; merge remains gated on all green CI checks. Production remains build 4 (`a344f4f6`). No real AWS request,
credential, database change, deployment, feature flag or installer publication.

## Dependency provenance

All 24 direct AWS packages move to exact 3.1166.0. Lockfiles are generated only by
`dependency-fix.yml` (standard Ubuntu runner in this public repository). Runs
43085805696 and 43086817568 generated the AWS upgrade and corrected nested
DynamoDB overrides. Run 43087514434 adds directly imported Smithy dependencies
rather than relying on npm hoisting. No lockfile was hand-edited.

The October DynamoDB overrides intentionally avoided shared SDK changes. Under
the new client the old codec lacks `DynamoDBJsonCodec2`, causing construction to
fail before any transport. The two exact overrides now match the new client's
requirements: codec 3.973.58 and endpoint-discovery 3.972.39.

## ECS source review

Compared installed ECS 3.1166.0 declarations with the previous 3.1049.0 snapshot.
All nine changed definitions are recorded in `ecs-model-diff.json`: six new
reachable definitions, a trusted-execution field, optional resource value,
sharing strategy and NeuronDevice enum variant. There are 63 reachable definitions,
previously 57. The generator now resolves namespace-qualified interfaces without
overwriting their same-name alias. The forward-compatible `$UnknownMember` is
explicitly uninhabitable; known members carrying `$unknown` remain rejected.
No execution authority changes. New supported registration values affect the
existing content digest; returned observations still withhold raw configuration.

## S3 source review and tests

Reviewed installed `@aws-sdk/middleware-sdk-s3` 3.972.89
`throw200ExceptionsMiddleware`: it collects the bounded response once and replays
those bytes instead of teeing it. The previous second-tee assertion therefore
cannot describe this SDK. Its replacement asserts no tee exists and preserves
exact unavailable classification, one request, single native-byte charge and
native cleanup on source failure and abort. HTTP-200 Error XML refusal, deadline,
shared byte budgets, private-value withholding and fixed run-scoped version-pinned
SSE-KMS artifact checks stay intact. The bounded transport implementation is
unchanged; its explanatory comment now describes the actual middleware.

## Living-document scope

No connector behavior, routes, UI, public API, demo flow or guide changed; ModuleIntro,
demo scenarios, four SDKs, guide count and heading index therefore need no change.
The Ask Axiom corpus generator is checked for freshness. Handoff and remaining-work
records track this batch. CI and live acceptance are separate gates.

## Local verification

- Root TypeScript: PASS with a 12 GiB heap (the initial default-heap invocation
  exhausted memory; the subsequent ordinary 12 GiB check exited zero).
- Full Vitest: 1,562 files passed, 100 skipped, one failed file; 17,806 tests
  passed, 893 skipped, one expected failure, two failures. Both failures are the
  unchanged Apple-silicon-only `syntheticFixtureRecipe.test.ts`: the source pins
  schema SHA256 `50e1fbbf...eb031`, while current schema on both main and this
  branch is `4a8c274e...d202b`. The installed engine matches its pin. No change
  to that schema, script, test or hash is included here. This is not a full local
  green-suite claim. Linux CI skips those explicitly macOS-only tests.
- ECS projection and customer AWS reader: 40 tests PASS after compatibility fixes
  (also included in the full run). Expanded cloud transport tests pass in that run.
- Desktop TypeScript and Vite build: PASS; existing chunk/dynamic-import warnings.
- Python CLI: 36 tests PASS.
- Ask Axiom corpus regenerated: 104 sections, no output changes.
- Exact 24 AWS versions, direct Smithy dependencies, generated lock hash and
  schema generator freshness verified. Independent final diff review: no
  important remaining findings. GitHub PR #315 records CI and merge status for the exact candidate.

Not verified: real AWS credentials, live service reads, production behavior,
macOS fixture qualification, installed customer applications. No gates enabled.
