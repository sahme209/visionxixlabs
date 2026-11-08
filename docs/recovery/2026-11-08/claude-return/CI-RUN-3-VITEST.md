# CI run 3 (PR #202, commit 0609afcc) — 2026-11-08

| Workflow | Result |
|---|---|
| Test → Type check | **PASS** (190 → 0 errors) |
| Test → Vitest | **FAIL**: 73 failed / 17,433 passed / 893 skipped; 18 of 1,624 files |
| Test → production build | **not run** (skipped after the Vitest failure) |
| Desktop CI | PASS |
| Isolated website acceptance | PASS |

All 18 failing files are **unchanged on this branch**, so these failures were already on `main` `fe63452f`. They were hidden because the type-check always failed first.

**Environment-dependent** (the test assumes Codex's Mac or a local fixture):
- `syntheticFixtureRecipe` (2): needs `@prisma/engines/schema-engine-darwin-arm64`
- `outlookExactLocalTime` (6): expects `America/New_York`; CI runs in UTC
- `privateFixtureJoined` (2): 20 s timeouts (owned fixture DB)

**Test/code drift** (needs diagnosis):
- AI admission and billing: `genericAIAdmission` (10, `ai_text_policy_unavailable`), `pipelineBudgetReadBoundary` (17, `repo.$transaction is not a function`), `reservation` (13, 500s), `installedSdkComposition` (3), `currentAIAllowance` (1), `newTestUsageAllocation` (1), `admission-diagnostic` (1), `codeProposeProviderBoundary` (1), `codingDispatchManagerBoundary` (3) and `managerAggregateGuard` (2) (`AIProviderError`)
- UI: `pricingNavigationSelection` (`usePathname` mock missing), `app/product` page copy
- Desktop: `desktopReleaseVersions` (3), `privateReleaseMergeComposition` (1), `savedSignInRecovery` (5)

The raw log came from the run's log archive: `gh api repos/sahme209/visionxixlabs/actions/runs/42487513812/logs`. `gh run view --log` drops the long dot-reporter lines.
