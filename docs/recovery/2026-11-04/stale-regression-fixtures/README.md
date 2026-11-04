# Five recorded failures: root causes and test-only corrections

The five unrelated failures retained by the prior navigation run were investigated against current mounted source. No production defect was established by these failures, and no runtime checks were removed.

## Desktop authority source contract

Four assertions still looked for logic in resolveRequestDesktopSession.ts after its extraction to desktopSessionResolverCore.ts. The test now first binds the mounted wrapper to the exact imported factory and token/session/membership/commercial/API-key dependencies, then applies the original assertions to that core. Accepted membership checking remains asserted in the wrapper. Focused contract, entitlement and logging checks passed33tests across3files, with mocked authorities only. This is not actual customer authentication, current native acceptance or complete Governance.

## Unavailable notification

The old ai_coding fixture lacked the transaction interface required by the real coding-exposure reader. It therefore correctly refused financial verification before reaching the executor. The corrected fixture supplies a matching locked run, empty companion ledger and one zero-cost current stage, retaining original unavailable executor/no external action/failed run assertions. Two additional cases explicitly deny missing and unreadable financial proof and assert zero notification executor calls. Focused3tests passed. All database objects/provider effects are simulated; no actual database or provider call occurred.

No full-suite clean result is asserted. The original broad-selection failure log remains preserved in navigation-resize-focus. No new build, push, deployment, schema change, native restart or permissions occurred. Both repairs are test-only and retain current refusal behavior.

Exact desktop command: `node scripts/run-vitest.mjs lib/__tests__/desktopFirstRunContract.test.ts lib/desktop/__tests__/resolveRequestDesktopSessionEntitlement.test.ts lib/desktop/__tests__/resolveRequestDesktopSessionLogging.test.ts`. The author tool output (chunk aec5bf, exit0, 08:10:17) records33tests/3files; no raw desktop log was saved and none is claimed. Notification raw output is preserved alongside this report.
