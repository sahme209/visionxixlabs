# Bounded offline support retrieval evidence — failed invocation

Status: READY for independent evidence review; verification failed, no successful expanded dataset result claimed.

Base/worktree: `0000ae1ef9060460a03789481b15b82a6bef5c24`, `/private/tmp/axiom-b5-offline-20261104`, branch `codex/b5-expanded-offline-evidence`. No code, test, article, schema or evaluator edits; no commit/push/integration. Worktree clean.

## Exact selected invocation

Operator executed `sh /private/tmp/axiom-b5-offline-evidence/run.sh > /private/tmp/axiom-b5-offline-evidence/selected-tests.log 2>&1`, then captured `result=$?` to `selected-tests-exit.txt` (1). The owned run.sh contains exactly:

```sh
cd /private/tmp/axiom-b5-offline-20261104 || exit 90
exec /usr/bin/env -i PATH=/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/private/tmp/axiom-b5-offline-evidence TMPDIR=/private/tmp/axiom-b5-offline-evidence/fixtures NODE_ENV=test NODE_COMPILE_CACHE=/private/tmp/axiom-b5-offline-evidence/node-cache /usr/bin/sandbox-exec -f /private/tmp/axiom-b5-offline-evidence/deny.sb /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node --test --test-name-pattern='synthetic exact extraction, canonical citation and determinism|all exact unchanged real drafts fail metadata gate and actual bounded byte pipeline' scripts/support-knowledge/tests/pipeline.test.cjs
```

Actual tools.exec_command chunk `bfb3bb`, synchronous shell exit0 (capture/read shell commands), captured selected Node exit1; tool wall_time_seconds0.046116084, runner reports89.925625ms. No active session handle. One selected Node-test invocation only. No full52-test suite/evaluator autorun/native909/private compiled consumer.

Node executable previously identified as v24.21.0/Unicode17.0. AJV loaded read-only from pinned4087 dependency symlink. Kernel profile denies network and writes to entire canonical tree, pinned dependency tree and isolated worktree. HOME/TMPDIR/compile cache owned in evidence folder. Existing core bounded reader itself uses fixed sandbox-exec/cat with cleared worker env, bounded bytes/time and exact regular-file policy; no source prose executed.

## Observed result, not intended result

Two selected tests,0pass,2fail. Synthetic positive control actual status `no_answer`, expected `selected`; it failed before subsequent simulationOnly/customerEligible/citation/determinism assertions. Therefore those positive-control outcomes were not established by this run.

Real-draft test failed its first `identity.bundle.files` observed real-article SHA assertion at pipeline.test.cjs448. The loop did not complete24 articles. The selected test code asserts `publicMetadataEligible(...)=false`, copies exact bytes into synthetic fixtures, expects `integrity_failure`, then asserts bounded reader observed real hash. Failure here means this run does not establish expanded24-draft metadata/pipeline coverage. No successful real customer result or eligibility claimed. Underlying early refusal cause is unconfirmed; no diagnosis run, rerun, trust-root patch, metadata change or proposal attempted after failure.

Even a successful version of this test would not independently prove every real full bundle's eligibility: real article bytes are inserted into a synthetic SIMULATED catalog/evaluation with other intentional metadata/binding mismatches. `integrity_failure` there is not a standalone complete customer-eligibility proof. Proposed article evaluation fixtures remain proposed-not-executed prose, not executed retrieval response criteria.

## Preservation

All24 article versions before/after byte hashes and lengths are identical. Dataset manifests hash identically. Original core/test/fixture/CLI/evaluator/two schema hashes captured before invocation and rechecked unchanged. All owned per-test fixture roots were removed through existing t.after cleanup despite failure; zero remain. Existing source logs untouched. Only explicit operator redirects and evidence metadata writes created reports outside source.

No browser/provider/DB/native/auth/credential/Keychain/Security/helper/AI/network/install/build actions. No expanded successful B5/production/customer/Governance acceptance claim. Independent evidence review must decide any separately authorized next step.

## Subsequent one-shot synthetic diagnostic

The unchanged nested child launch was reproduced with only a fresh 29-byte synthetic file, under the exact original outer environment/profile and unchanged inner-reader profile semantics. The child exited71 with zero bytes and bounded stderr `sandbox-exec: sandbox_apply: Operation not permitted`. Nodev24.21.0/Unicode17.0 were observed. This establishes that the nested harness cannot perform the bounded read in this diagnostic; the original generic failures did not retain child stderr and may have additional causes. It is not a passing retrieval evaluation or evidence of a defective production reader. Both restrictions remain unchanged; no selected tests were rerun. Next: review a containment-preserving evaluation harness before another invocation.
